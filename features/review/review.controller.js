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

// @map: getMyDriverRatingStats (Статистика рейтинга водителя) [Driver only]
export const getMyDriverRatingStats = async (req, res) => {
  try {
    const driverId = req.user.id; // берем из токена

    // 1) Группировка по score
    const grouped = await Review.findAll({
      where: {
        targetId: driverId,
        targetRole: "driver",
      },
      attributes: [
        "score",
        [sequelize.fn("COUNT", sequelize.col("score")), "count"],
      ],
      group: ["score"],
      order: [["score", "DESC"]],
    });

    // 2) Считаем total
    const total = grouped.reduce(
      (acc, row) => acc + Number(row.get("count")),
      0
    );

    // 3) Средний рейтинг
    const avgRow = await Review.findOne({
      where: {
        targetId: driverId,
        targetRole: "driver",
      },
      attributes: [[sequelize.fn("AVG", sequelize.col("score")), "avgRating"]],
    });

    const average = avgRow?.get("avgRating")
      ? Number(parseFloat(avgRow.get("avgRating")).toFixed(2))
      : null;

    // 4) Нормализуем формат { 5: x, 4: y, ... }
    const countsByScore = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    grouped.forEach((row) => {
      const score = Number(row.get("score"));
      const count = Number(row.get("count"));
      if (countsByScore[score] !== undefined) {
        countsByScore[score] = count;
      }
    });

    return res.json({
      success: true,
      total,
      average,
      countsByScore,
    });
  } catch (e) {
    console.error("getMyDriverRatingStats error:", e);
    return res.status(500).json({
      error: "Ошибка сервера при получении статистики рейтинга",
    });
  }
};
