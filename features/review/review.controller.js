import Review from "./review.model.js";
import Driver from "../driver/driver.model.js";
import Client from "../client/client.model.js";
import sequelize from "../../config/db.js";

// Вспомогательная функция: Пересчет рейтинга
const updateTargetRating = async (targetId, targetRole) => {
  try {
    // 1. Считаем среднее
    const result = await Review.findOne({
      where: { targetId, targetRole },
      attributes: [[sequelize.fn("AVG", sequelize.col("score")), "avgRating"]],
    });

    const avgRating = parseFloat(result?.dataValues?.avgRating || 5.0).toFixed(
      2
    );

    // 2. Обновляем целевую таблицу
    if (targetRole === "driver") {
      await Driver.update({ rating: avgRating }, { where: { id: targetId } });
    } else if (targetRole === "client") {
      await Client.update({ rating: avgRating }, { where: { id: targetId } });
    }
  } catch (e) {
    console.error("Ошибка пересчета рейтинга:", e);
  }
};

// @map: createReview (Оставить отзыв) -> score, comment, targetId, targetRole [Client, Driver]
export const createReview = async (req, res) => {
  try {
    const { orderId, targetId, targetRole, score, comment } = req.body;
    const reviewerId = req.user.id; // Из токена

    // Проверка на дубликат (один отзыв на заказ от одного юзера)
    const existing = await Review.findOne({ where: { orderId, reviewerId } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Вы уже оставили отзыв к этому заказу" });
    }

    const review = await Review.create({
      orderId,
      reviewerId,
      targetId,
      targetRole,
      score,
      comment,
    });

    // Асинхронно обновляем общий рейтинг (не заставляем клиента ждать)
    updateTargetRating(targetId, targetRole);

    return res.status(201).json({ success: true, review });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка при создании отзыва" });
  }
};

// @map: getReviewsByTarget (Получить отзывы) -> score, comment [Public]
export const getReviewsByTarget = async (req, res) => {
  try {
    const { targetId, targetRole, page = 1, limit = 10 } = req.query;

    const { rows, count } = await Review.findAndCountAll({
      where: { targetId, targetRole },
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      rows,
      count,
    });
  } catch (e) {
    res.status(500).json({ error: "Ошибка загрузки отзывов" });
  }
};

// @map: deleteReview (Удалить отзыв) -> id [Admin]
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByPk(id);

    if (!review) return res.status(404).json({ error: "Отзыв не найден" });

    const { targetId, targetRole } = review;

    await review.destroy();

    // Пересчитываем рейтинг после удаления
    updateTargetRating(targetId, targetRole);

    return res.json({ success: true, message: "Отзыв удален" });
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

export const getMyDriverRatingStats = async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    // 🧮 Параметры рейтинга
    const WINDOW_SIZE = 300; // учитываем только последние 300 отзывов
    const BASE_COUNT = 150; // виртуальные "подарочные" оценки
    const BASE_SCORE = 5; // все они = 5★

    // Базовый фильтр по отзывам
    const where = {
      targetId: driverId,
      targetRole: "driver",
    };

    // Если есть поле status — считаем только активные отзывы
    if (Review.rawAttributes?.status) {
      where.status = "active";
    }

    // 1) Берём последние 300 отзывов по createdAt DESC
    const reviews = await Review.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: WINDOW_SIZE,
    });

    // 2) Считаем распределение по звёздам и сумму
    const countsByScore = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    let sumScores = 0;

    for (const r of reviews) {
      const score = Number(r.score);
      if (countsByScore[score] !== undefined) {
        countsByScore[score] += 1;
        sumScores += score;
      }
    }

    const realTotal = reviews.length;

    // 3) Реальное среднее по окну (без подарочных 150×5)
    const averageRaw =
      realTotal > 0 ? Number((sumScores / realTotal).toFixed(2)) : null;

    // 4) Сглаженный рейтинг с учётом базы 150×5
    let average;

    if (realTotal === 0) {
      // Нет реальных отзывов — показываем чистые 5.0
      average = BASE_SCORE;
    } else {
      const blended =
        (sumScores + BASE_SCORE * BASE_COUNT) / (realTotal + BASE_COUNT);
      average = Number(blended.toFixed(2));
    }

    return res.json({
      success: true,

      // цифры для UI
      total: realTotal, // реальное число отзывов в окне (0..300)
      average, // сглаженный рейтинг с базой 150×5
      countsByScore, // распределение по 1–5 в окне

      // тех/аналитика на будущее
      averageRaw, // реальное среднее по окну (без базы)
      windowSize: WINDOW_SIZE,
      baseScore: BASE_SCORE,
      baseCount: BASE_COUNT,
    });
  } catch (e) {
    console.error("[RATING_STATS_ERROR]", {
      route: "GET /reviews/my-rating/stats",
      driverId: req?.user?.id || null,
      type: e?.name || "UNEXPECTED_ERROR",
      message: e?.message,
      sqlMessage: e?.original?.sqlMessage,
      stack: e?.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      error: "Ошибка сервера при получении статистики рейтинга",
    });
  }
};
