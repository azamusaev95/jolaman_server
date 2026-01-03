import sequelize from "../config/db.js";
import Driver from "../features/driver/driver.model.js";
import { fakerRU as faker } from "@faker-js/faker";

const seedDriverLevels = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    const drivers = await Driver.findAll({
      attributes: ["id", "firstName", "lastName", "phone"],
    });

    console.log(`👨‍🏭 Найдено водителей: ${drivers.length}`);
    console.log("⚙️ Обновляем level / priorityScore / levelUpdatedAt ...");

    for (const driver of drivers) {
      // 🎲 случайное распределение уровней
      const rnd = Math.random();

      let level = "novice";
      let priorityScore = 0;

      if (rnd < 0.5) {
        level = "novice";
        priorityScore = 0;
      } else if (rnd < 0.85) {
        level = "experienced";
        priorityScore = 10;
      } else {
        level = "pro";
        priorityScore = 30;
      }

      const levelUpdatedAt = faker.date.recent({ days: 10 });

      await driver.update(
        {
          level,
          priorityScore,
          levelUpdatedAt,
        },
        { fields: ["level", "priorityScore", "levelUpdatedAt"] } // 👈 гарантируем обновление только этих полей
      );

      console.log(`✔️ ${driver.phone} → ${level} (${priorityScore})`);
    }

    console.log("🎯 Готово! Все уровни обновлены.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Ошибка при обновлении уровней:", err);
    process.exit(1);
  }
};

seedDriverLevels();
