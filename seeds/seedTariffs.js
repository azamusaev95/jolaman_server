import sequelize from "../config/db.js"; // 👈 Проверь путь
import Tariff from "../features/tariff/tariff.model.js"; // 👈 Проверь путь

const seedTariffs = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // Массив тарифов строго по твоей модели
    // Цены примерные для Бишкека (можешь поменять)
    const tariffsData = [
      // --- ТАКСИ ---
      {
        category: "taxi",
        name: "econom",
        basePrice: 60, // Посадка
        pricePerKm: 12, // Цена за км
        pricePerMinute: 3, // В пути
        waitingPrice: 5, // Ожидание
        isActive: true,
      },
      {
        category: "taxi",
        name: "comfort",
        basePrice: 90,
        pricePerKm: 16,
        pricePerMinute: 4,
        waitingPrice: 7,
        isActive: true,
      },
      {
        category: "taxi",
        name: "comfortPlus",
        basePrice: 120,
        pricePerKm: 20,
        pricePerMinute: 5,
        waitingPrice: 8,
        isActive: true,
      },
      {
        category: "taxi",
        name: "business",
        basePrice: 200,
        pricePerKm: 30,
        pricePerMinute: 10,
        waitingPrice: 15,
        isActive: true,
      },

      // --- ДОСТАВКА ---
      {
        category: "delivery",
        name: "courier_foot",
        basePrice: 100, // Подороже посадка, т.к. курьер
        pricePerKm: 10, // Но дешевле км (медленно)
        pricePerMinute: 2,
        waitingPrice: 5,
        isActive: true,
      },
      {
        category: "delivery",
        name: "courier_bike",
        basePrice: 110,
        pricePerKm: 12,
        pricePerMinute: 3,
        waitingPrice: 5,
        isActive: true,
      },
      {
        category: "delivery",
        name: "courier_moto",
        basePrice: 130,
        pricePerKm: 15,
        pricePerMinute: 4,
        waitingPrice: 6,
        isActive: true,
      },
      {
        category: "delivery",
        name: "courier_car",
        basePrice: 150,
        pricePerKm: 18,
        pricePerMinute: 5,
        waitingPrice: 8,
        isActive: true,
      },

      // --- ГРУЗОВОЙ ---
      {
        category: "cargo",
        name: "cargo_driver",
        basePrice: 500,
        pricePerKm: 40,
        pricePerMinute: 10,
        waitingPrice: 20, // Погрузка/разгрузка стоит дорого
        isActive: true,
      },
    ];

    console.log("📦 Создаем тарифы...");

    // Используем bulkCreate с updateOnDuplicate
    // Если тариф с таким name уже есть, он просто обновит цены на новые
    await Tariff.bulkCreate(tariffsData, {
      updateOnDuplicate: [
        "basePrice",
        "pricePerKm",
        "pricePerMinute",
        "waitingPrice",
        "isActive",
      ],
    });

    console.log(`✅ Успешно создано/обновлено ${tariffsData.length} тарифов!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при создании тарифов:", error);
    process.exit(1);
  }
};

seedTariffs();
