// src/scripts/recalculateDriverRatings.js

import sequelize from "../config/db.js";

import Driver from "../features/driver/driver.model.js";
import Review from "../features/review/review.model.js";

const BASE_REVIEWS = 150;
const BASE_SCORE = 5;

/**
 * Скрипт:
 * - берёт все отзывы по водителям (targetRole = driver, status=active если есть)
 * - считает realAvg и realTotal
 * - применяет формулу с 150 пятёрками
 * - обновляет Driver.rating по новой формуле
 */
async function recalculateDriverRatings() {
  console.log("🚀 Запуск пересчёта рейтингов водителей по новой формуле...");

  try {
    await sequelize.authenticate();
    console.log("✅ Подключение к БД OK");
  } catch (err) {
    console.error("❌ Не удалось подключиться к БД:", err.message);
    console.error(err);
    process.exit(1);
  }

  // --- 1. Собираем агрегаты по отзывам для водителей ---
  let reviewRows;

  try {
    const where = {
      targetRole: "driver",
    };

    // Если в модели есть поле status — фильтруем только active
    if (Review.rawAttributes?.status) {
      where.status = "active";
    }

    reviewRows = await Review.findAll({
      where,
      attributes: [
        "targetId",
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("AVG", sequelize.col("score")), "avgScore"],
      ],
      group: ["targetId"],
    });

    console.log(
      `📊 Найдено агрегатов по отзывам для водителей: ${reviewRows.length}`
    );
  } catch (err) {
    console.error("❌ Ошибка при выборке агрегатов по отзывам:", err.message);
    console.error(err);
    process.exit(1);
  }

  // Map: driverId -> { total, realAvg }
  const ratingStats = new Map();

  for (const row of reviewRows) {
    const driverId = row.get("targetId");
    const total = Number(row.get("total")) || 0;
    const avgScoreRaw = row.get("avgScore");
    const realAvg = avgScoreRaw != null ? Number(avgScoreRaw) : null;

    ratingStats.set(driverId, { total, realAvg });
  }

  // --- 2. Загружаем всех водителей ---
  let drivers;

  try {
    drivers = await Driver.findAll();
  } catch (err) {
    console.error("❌ Ошибка при загрузке водителей:", err.message);
    console.error(err);
    process.exit(1);
  }

  if (!drivers.length) {
    console.error("❌ Нет водителей в БД (таблица drivers пуста)");
    process.exit(1);
  }

  console.log(`👨‍✈️ Всего водителей для пересчёта: ${drivers.length}`);

  // --- 3. Пересчитываем рейтинг по формуле с 150 пятёрками ---
  const transaction = await sequelize.transaction();
  let updatedCount = 0;

  try {
    for (const driver of drivers) {
      const stats = ratingStats.get(driver.id);

      let realTotal = 0;
      let realAvg = null;
      let shownAvg;

      if (stats && stats.total > 0 && stats.realAvg != null) {
        realTotal = stats.total;
        realAvg = stats.realAvg;

        // Формула с "виртуальными" 150 пятёрками
        shownAvg =
          (realAvg * realTotal + BASE_SCORE * BASE_REVIEWS) /
          (realTotal + BASE_REVIEWS);
      } else {
        // Нет ни одного реального отзыва: считаем, что у него пока "идеальные" 5,
        // но это чисто отображение — при появлении отзывов формула плавно опустит рейтинг.
        realTotal = 0;
        realAvg = null;
        shownAvg = BASE_SCORE;
      }

      const rounded = Number(shownAvg.toFixed(2));

      await Driver.update(
        {
          rating: rounded,
          // если решишь добавить потом totalReviews в Driver — можно будет раскомментировать:
          // totalReviews: realTotal,
        },
        {
          where: { id: driver.id },
          transaction,
        }
      );

      updatedCount += 1;

      console.log(
        `🔁 Driver ${driver.id}: realTotal=${realTotal}, realAvg=${
          realAvg?.toFixed?.(2) ?? "null"
        }, rating=${rounded}`
      );
    }

    await transaction.commit();
    console.log("\n✅ Пересчёт рейтингов успешно завершён");
    console.log(`   ➤ Обновлено водителей: ${updatedCount}`);
  } catch (error) {
    console.error("\n❌ Ошибка при пересчёте рейтингов:", error.message);
    console.error(error);
    try {
      await transaction.rollback();
      console.log("↩️ Транзакция откатена");
    } catch (rollbackErr) {
      console.error("❌ Ошибка при откате транзакции:", rollbackErr.message);
      console.error(rollbackErr);
    }
    process.exit(1);
  }

  // --- 4. Закрываем соединение ---
  try {
    await sequelize.close();
    console.log("🔌 Соединение с БД закрыто");
  } catch (closeErr) {
    console.error("⚠️ Ошибка при закрытии соединения с БД:", closeErr.message);
  }

  process.exit(0);
}

// Запуск скрипта
recalculateDriverRatings();
