// fix_enum.js
import sequelize from "./config/db.js"; // Импортируем твой настроенный экземпляр

const runFix = async () => {
  try {
    console.log("🔌 Подключаемся к базе через config/db.js...");
    await sequelize.authenticate();
    console.log("✅ Подключение успешно.");

    console.log("🛠  Выполняем SQL запрос...");

    const sql = `
      ALTER TABLE "car_models" 
      ALTER COLUMN "powertrain" TYPE VARCHAR(255) 
      USING "powertrain"::text;

      DROP TYPE IF EXISTS "enum_car_models_powertrain";
      DROP TYPE IF EXISTS "public"."enum_car_models_powertrain";
    `;

    // Выполняем "сырой" запрос
    await sequelize.query(sql);

    console.log("🎉 Успех! Колонка теперь VARCHAR, данные сохранены.");
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
    console.error(error); // Вывод полного стека ошибки
  } finally {
    // Закрываем соединение, чтобы скрипт завершился
    await sequelize.close();
    console.log("👋 Соединение закрыто.");
  }
};

runFix();
