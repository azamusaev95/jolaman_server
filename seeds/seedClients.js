import sequelize from "../config/db.js";
// ⚠️ ВАЖНО: Проверь, где лежит модель.
// Если она в feature/client, путь будет таким:
import Client from "../features/client/client.model.js";
// Если просто в models: import Client from "./src/models/client.model.js";

import { fakerRU as faker } from "@faker-js/faker";
import bcrypt from "bcrypt"; // или "bcryptjs"

const seedClients = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    const clientsData = [];
    const COUNT = 50; // Создадим 50 клиентов

    // Генерируем общий пароль "123456" для всех
    const salt = await bcrypt.genSalt(10);
    const commonPasswordHash = await bcrypt.hash("123456", salt);

    console.log(`🚀 Создаем ${COUNT} клиентов...`);

    for (let i = 1; i <= COUNT; i++) {
      // Формируем номер: 0770 + 000001 (дополняем нулями до 6 цифр)
      const suffix = String(i).padStart(6, "0");
      const phone = `0770${suffix}`; // Итог: 0770000001

      clientsData.push({
        phone: phone,
        // В твоей модели поле называется "name"
        name: faker.person.fullName(),

        passwordHash: commonPasswordHash,

        // Разнообразные данные
        rating: faker.number.float({ min: 4.0, max: 5.0, precision: 0.1 }),
        language: faker.helpers.arrayElement(["ru", "ru", "kg", "en"]),
        bonusBalance: faker.number.int({ min: 0, max: 500 }), // Немного бонусов

        fcmToken: null, // Пока без токена
        isActive: true,
      });
    }

    // Сохраняем в БД
    await Client.bulkCreate(clientsData, {
      validate: true,
      ignoreDuplicates: true,
    });

    console.log(`✅ Успешно создано ${COUNT} клиентов!`);
    console.log("🔑 Тестовые данные:");
    console.log("   Логин:  0770000001");
    console.log("   Пароль: 123456");

    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при создании клиентов:", error);
    process.exit(1);
  }
};

seedClients();
