// src/scripts/seedFakeOrdersAndReviews.js

import sequelize from "../config/db.js";

import Driver from "../features/driver/driver.model.js";
import Client from "../features/client/client.model.js";
import Order from "../features/order/order.model.js";
import Review from "../features/review/review.model.js";
import Tariff from "../features/tariff/tariff.model.js";

import { faker } from "@faker-js/faker";

/**
 * Сколько заказов генерировать на каждого водителя.
 * При 100 водителях и 10 заказах будет ~1000 заказов.
 */
const ORDERS_PER_DRIVER = 10;

// --- Хелпер для случайных чисел ---
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Хелпер для накопления статистики рейтинга ---
function addRatingStat(map, id, score) {
  if (!map.has(id)) {
    map.set(id, { sum: 0, count: 0 });
  }
  const stat = map.get(id);
  stat.sum += score;
  stat.count += 1;
}

/**
 * Основная функция сидирования:
 * - создаём заказы
 * - создаём отзывы
 * - обновляем rating у Driver и Client
 */
async function seedFakeOrdersAndReviews() {
  console.log("🚀 Запуск сидера: фейковые заказы и рейтинги...");

  try {
    await sequelize.authenticate();
    console.log("✅ Подключение к БД OK");
  } catch (err) {
    console.error("❌ Не удалось подключиться к БД:", err.message);
    console.error(err);
    process.exit(1);
  }

  // ⚠️ Предполагается, что таблицы уже созданы миграциями / sync в другом месте

  let drivers;
  let clients;
  let tariffs;

  try {
    drivers = await Driver.findAll();
    clients = await Client.findAll();
    tariffs = await Tariff.findAll();
  } catch (err) {
    console.error(
      "❌ Ошибка при загрузке базовых данных (Driver/Client/Tariff):",
      err.message
    );
    console.error(err);
    process.exit(1);
  }

  if (!drivers.length) {
    console.error("❌ Нет водителей в БД (таблица drivers пуста)");
    process.exit(1);
  }
  if (!clients.length) {
    console.error("❌ Нет клиентов в БД (таблица clients пуста)");
    process.exit(1);
  }
  if (!tariffs.length) {
    console.error("❌ Нет тарифов в БД (таблица tariffs пуста)");
    process.exit(1);
  }

  console.log(
    `👨‍✈️ Водителей: ${drivers.length}, 👤 Клиентов: ${clients.length}, 💸 Тарифов: ${tariffs.length}`
  );
  console.log(
    `📦 Планируем создать ~${drivers.length * ORDERS_PER_DRIVER} заказов`
  );

  // Карты для накопления рейтинга
  const driverRatingStats = new Map(); // driverId -> { sum, count }
  const clientRatingStats = new Map(); // clientId -> { sum, count }

  // Счётчики для логов
  let createdOrdersCount = 0;
  let createdReviewsCount = 0;

  // Можно всё обернуть в транзакцию, чтобы сидер был атомарным
  const transaction = await sequelize.transaction();

  try {
    // --- Основной цикл по водителям ---
    for (let driverIndex = 0; driverIndex < drivers.length; driverIndex++) {
      const driver = drivers[driverIndex];

      console.log(
        `\n👨‍✈️ Водитель ${driverIndex + 1}/${drivers.length} — id=${driver.id}`
      );

      // Для каждого водителя создаём N заказов
      for (let orderIndex = 0; orderIndex < ORDERS_PER_DRIVER; orderIndex++) {
        console.log(
          `  📦 Заказ ${
            orderIndex + 1
          }/${ORDERS_PER_DRIVER} для этого водителя...`
        );

        // случайный клиент
        const client = clients[randomInt(0, clients.length - 1)];
        // случайный тариф
        const tariff = tariffs[randomInt(0, tariffs.length - 1)];

        // --- Время поездки: последние 30 дней ---
        const startDate = faker.date.recent({ days: 30 });
        const durationMin = randomInt(5, 45);
        const finishDate = new Date(
          startDate.getTime() + durationMin * 60 * 1000
        );

        // --- Расстояние и цена ---
        const distanceKm = Number((Math.random() * (25 - 1) + 1).toFixed(2)); // от 1 до 25 км
        const basePrice = randomInt(80, 250); // "тариф" базовый
        const estimatedPrice = Number(
          (basePrice + distanceKm * randomInt(5, 15)).toFixed(2)
        );
        const finalPrice = Number(
          (estimatedPrice * (0.9 + Math.random() * 0.3)).toFixed(2)
        ); // +/– 10–20%

        // --- Адреса ---
        const fromAddress = faker.location.streetAddress();
        const toAddress = faker.location.streetAddress();

        const fromLat = Number(faker.location.latitude());
        const fromLng = Number(faker.location.longitude());
        const toLat = Number(faker.location.latitude());
        const toLng = Number(faker.location.longitude());

        // --- Создаём заказ (completed) ---
        const order = await Order.create(
          {
            clientId: client.id,
            driverId: driver.id,
            tariffId: tariff.id,

            publicNumber: String(randomInt(1000, 9999)),

            status: "completed",
            cancelReason: null,

            fromAddress,
            fromLat,
            fromLng,

            toAddress,
            toLat,
            toLng,

            estimatedPrice,
            finalPrice,
            paymentMethod: "cash",
            isPaid: true,

            distanceKm,
            durationMin,
            comment: faker.lorem.sentence(),

            scheduledAt: null,
            startedAt: startDate,
            finishedAt: finishDate,
          },
          { transaction }
        );

        createdOrdersCount += 1;
        console.log(`    ✅ Order created: id=${order.id}`);

        // --- Генерируем оценки (1–5) ---
        // Сделаем более реалистичное распределение: в основном 4–5, иногда 3, редко 1–2
        function generateScore() {
          const r = Math.random();
          if (r < 0.05) return 1; // 5% очень плохие
          if (r < 0.1) return 2; // 5% плохие
          if (r < 0.3) return 3; // 20% средние
          if (r < 0.7) return 4; // 40% хорошие
          return 5; // 30% отличные
        }

        const scoreForDriver = generateScore();
        const scoreForClient = generateScore();

        // --- Отзыв клиента о водителе ---
        const driverReview = await Review.create(
          {
            orderId: order.id,
            reviewerId: client.id,
            targetId: driver.id,
            targetRole: "driver",
            score: scoreForDriver,
            comment: faker.lorem.sentence(),
          },
          { transaction }
        );
        createdReviewsCount += 1;
        addRatingStat(driverRatingStats, driver.id, scoreForDriver);
        console.log(
          `    ⭐ Review for driver created: id=${driverReview.id}, score=${scoreForDriver}`
        );

        // --- (Опционально) отзыв водителя о клиенте ---
        const clientReview = await Review.create(
          {
            orderId: order.id,
            reviewerId: driver.id,
            targetId: client.id,
            targetRole: "client",
            score: scoreForClient,
            comment: faker.lorem.sentence(),
          },
          { transaction }
        );
        createdReviewsCount += 1;
        addRatingStat(clientRatingStats, client.id, scoreForClient);
        console.log(
          `    ⭐ Review for client created: id=${clientReview.id}, score=${scoreForClient}`
        );
      }

      console.log(
        `  ✅ Водитель ${driver.id}: создано ${ORDERS_PER_DRIVER} заказов`
      );
    }

    console.log("\n🧮 Расчёт рейтингов по собранной статистике...");

    // --- Обновляем рейтинг водителей ---
    for (const [driverId, { sum, count }] of driverRatingStats.entries()) {
      const avg = sum / count;
      const rounded = Number(avg.toFixed(2));
      console.log(
        `  🔁 Обновляем рейтинг водителя ${driverId}: avg=${rounded} (по ${count} отзывам)`
      );
      await Driver.update(
        { rating: rounded },
        { where: { id: driverId }, transaction }
      );
    }

    // --- Обновляем рейтинг клиентов ---
    for (const [clientId, { sum, count }] of clientRatingStats.entries()) {
      const avg = sum / count;
      const rounded = Number(avg.toFixed(2));
      console.log(
        `  🔁 Обновляем рейтинг клиента ${clientId}: avg=${rounded} (по ${count} отзывам)`
      );
      await Client.update(
        { rating: rounded },
        { where: { id: clientId }, transaction }
      );
    }

    await transaction.commit();

    console.log("\n✅ Сидирование успешно завершено");
    console.log(`   ➤ Всего создано заказов: ${createdOrdersCount}`);
    console.log(`   ➤ Всего создано отзывов: ${createdReviewsCount}`);
  } catch (error) {
    console.error("\n❌ Ошибка при сидировании:", error.message);
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

  try {
    await sequelize.close();
    console.log("🔌 Соединение с БД закрыто");
  } catch (closeErr) {
    console.error("⚠️ Ошибка при закрытии соединения с БД:", closeErr.message);
  }

  process.exit(0);
}

// Запуск
seedFakeOrdersAndReviews();
