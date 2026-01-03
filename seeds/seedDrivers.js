import sequelize from "../config/db.js";
import Driver from "../features/driver/driver.model.js";
import { fakerRU as faker } from "@faker-js/faker";
import bcrypt from "bcrypt"; // 👇 Убедись, что установлен (npm install bcrypt или bcryptjs)

const seedDrivers = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // Очищаем старых водителей, чтобы не было конфликтов телефонов
    // await sequelize.sync({ force: true });
    // console.log("📦 Таблицы пересозданы.");

    const driversData = [];
    const COUNT = 100;

    // Генерируем ХЕШ пароля один раз (это быстро), чтобы у всех был пароль "123456"
    // Если у тебя библиотека называется 'bcryptjs', поменяй импорт выше
    const salt = await bcrypt.genSalt(10);
    const commonPasswordHash = await bcrypt.hash("123456", salt);

    console.log(`🚀 Создаем ${COUNT} водителей с паролем "123456"...`);

    for (let i = 1; i <= COUNT; i++) {
      // 1. Формируем последовательный телефон
      // i = 1  -> 001
      // i = 10 -> 010
      const suffix = String(i).padStart(3, "0");
      const phone = `+996550000${suffix}`; // Итог: +996550000001

      // Координаты (Центр Бишкека)
      const lat = 42.87 + (Math.random() - 0.5) * 0.05;
      const lon = 74.59 + (Math.random() - 0.5) * 0.05;

      // Случайные данные для остальных полей
      const workTypes = ["taxi", "courier_foot", "courier_auto"];
      const statuses = ["active", "on_shift", "active", "pending"];

      driversData.push({
        // Личные данные
        firstName: faker.person.firstName("male"),
        lastName: faker.person.lastName("male"),
        phone: phone, // 👈 Твой последовательный номер

        // Документы (генерируем уникальные, чтобы база не ругалась)
        pin: `201011990${String(i).padStart(5, "0")}`, // Уникальный ПИН
        passportNumber: `ID${String(i).padStart(7, "0")}`, // Уникальный паспорт
        licenseNumber: `KG${String(i).padStart(7, "0")}`, // Уникальные права

        // Детали
        balance: faker.number.int({ min: 0, max: 2000 }),
        rating: faker.number.float({ min: 4.5, max: 5.0, precision: 0.1 }),
        status: faker.helpers.arrayElement(statuses),
        workType: faker.helpers.arrayElement(workTypes),

        // Локация
        currentLat: lat,
        currentLon: lon,
        isOnline: true,

        // ПАРОЛЬ "123456"
        passwordHash: commonPasswordHash,
      });
    }

    // Сохраняем всех разом
    await Driver.bulkCreate(driversData, {
      validate: true,
      ignoreDuplicates: true,
    });

    console.log("✅ Успешно!");
    console.log("🔑 Тестовые данные:");
    console.log("   Логин:  +996550000001 (и до ...050)");
    console.log("   Пароль: 123456");

    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  }
};

seedDrivers();
