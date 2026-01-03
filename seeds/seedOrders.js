import sequelize from "../config/db.js";
import { fakerRU as faker } from "@faker-js/faker";

// Импорт моделей (ПРОВЕРЬ ПУТИ!)
// Если используешь index.js, можно импортировать так:
// import { Order, Client, Driver, Tariff } from "./src/models/index.js";
// Если по отдельности:
import Order from "../features/order/order.model.js"; // Или feature/order/order.model.js
import Client from "../features/client/client.model.js"; // Проверь путь!
import Driver from "../features/driver/driver.model.js";
import Tariff from "../features/tariff/tariff.model.js";

const seedOrders = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // 1. ПОЛУЧАЕМ РЕАЛЬНЫЕ ДАННЫЕ (нам нужны только ID)
    const clients = await Client.findAll({ attributes: ["id"] });
    const drivers = await Driver.findAll({ attributes: ["id"] });
    const tariffs = await Tariff.findAll({
      attributes: ["id", "basePrice", "pricePerKm"],
    });

    if (clients.length === 0 || drivers.length === 0 || tariffs.length === 0) {
      console.error(
        "❌ Ошибка: Сначала создай Клиентов, Водителей и Тарифы (npm run seed...)"
      );
      process.exit(1);
    }

    console.log(
      `📊 Найдено: ${clients.length} клиентов, ${drivers.length} водителей, ${tariffs.length} тарифов.`
    );
    console.log("🚀 Начинаем создание заказов...");

    const ordersData = [];
    const COUNT = 100; // Сколько заказов создать

    for (let i = 0; i < COUNT; i++) {
      // --- ВЫБИРАЕМ СЛУЧАЙНЫЕ СВЯЗИ ---
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const randomTariff = tariffs[Math.floor(Math.random() * tariffs.length)];

      // Статус заказа (большинство завершенные, немного новых)
      const status = faker.helpers.weightedArrayElement([
        { weight: 70, value: "completed" },
        { weight: 10, value: "cancelled" },
        { weight: 10, value: "new" },
        { weight: 10, value: "driver_assigned" },
      ]);

      // Водитель нужен только если заказ не "new"
      let randomDriver = null;
      if (status !== "new" && status !== "canceled_search") {
        randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      }

      // --- ГЕНЕРАЦИЯ ДАННЫХ ПОЕЗДКИ ---
      // Координаты (вокруг Бишкека)
      const fromLat = 42.87 + (Math.random() - 0.5) * 0.1;
      const fromLng = 74.59 + (Math.random() - 0.5) * 0.1;
      const toLat = 42.87 + (Math.random() - 0.5) * 0.1;
      const toLng = 74.59 + (Math.random() - 0.5) * 0.1;

      // Расчет цены (фейковый, но логичный)
      const dist = faker.number.float({ min: 2, max: 20 }); // км
      const estimatedPrice =
        Number(randomTariff.basePrice) + dist * Number(randomTariff.pricePerKm);
      const finalPrice = status === "completed" ? estimatedPrice : null;

      // Даты
      const createdAt = faker.date.past({ years: 1 }); // Заказ был в прошлом году
      const finishedAt =
        status === "completed"
          ? new Date(createdAt.getTime() + 20 * 60000)
          : null; // +20 мин

      // Создаем объект заказа
      // ВАЖНО: Мы используем create внутри цикла, чтобы сразу создать и точки маршрута (через include)
      // Если у тебя нет include, можно собрать массив и сделать bulkCreate

      await Order.create(
        {
          clientId: randomClient.id,
          driverId: randomDriver ? randomDriver.id : null,
          tariffId: randomTariff.id,

          publicNumber: faker.string.numeric(4), // Номер "1234"
          status: status,

          fromAddress: faker.location.streetAddress(),
          fromLat: fromLat,
          fromLng: fromLng,

          toAddress: faker.location.streetAddress(),
          toLat: toLat,
          toLng: toLng,

          estimatedPrice: estimatedPrice.toFixed(2),
          finalPrice: finalPrice ? finalPrice.toFixed(2) : null,

          paymentMethod: faker.helpers.arrayElement(["cash", "card", "bonus"]),
          comment: Math.random() > 0.7 ? "Позвонить перед выходом" : null,

          createdAt: createdAt,
          finishedAt: finishedAt,

          // Если у тебя настроена связь hasMany RoutePoints
          routePoints: [
            {
              sequence: 1,
              address: faker.location.streetAddress(),
              lat: fromLat,
              lng: fromLng,
            },
            {
              sequence: 2,
              address: faker.location.streetAddress(),
              lat: toLat,
              lng: toLng,
            },
          ],
        },
        {
          include: ["routePoints"], // Убедись, что связь в модели Order называется 'routePoints'
        }
      );
    }

    console.log(`✅ Успешно создано ${COUNT} заказов!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при создании заказов:", error);
    process.exit(1);
  }
};

seedOrders();
