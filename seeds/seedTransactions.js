import sequelize from "../config/db.js";
import { fakerRU as faker } from "@faker-js/faker";

// 👇 Проверь пути!
import Driver from "../features/driver/driver.model.js";
import DriverTransaction from "../features/driverTransaction/transaction.model.js";

const seedTransactions = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // ==========================================
    // 🧹 ШАГ 1: ПОЛНАЯ ОЧИСТКА (RESET)
    // ==========================================
    console.log("🧹 Очистка старых данных...");

    // 1. Удаляем ВСЕ старые транзакции
    // truncate: true быстрее и сбрасывает ID
    await DriverTransaction.destroy({ truncate: true, cascade: true });
    console.log("✅ Таблица транзакций очищена.");

    // 2. Обнуляем баланс ВСЕМ водителям
    await Driver.update({ balance: 0 }, { where: {} });
    console.log("✅ Баланс всех водителей сброшен на 0.");

    // ==========================================
    // 🚀 ШАГ 2: ГЕНЕРАЦИЯ НОВОЙ ИСТОРИИ
    // ==========================================
    const drivers = await Driver.findAll();
    console.log(`📊 Найдено водителей: ${drivers.length}`);

    if (drivers.length === 0) {
      console.log("❌ Нет водителей. Сначала запусти npm run seed:drivers");
      process.exit(1);
    }

    console.log("🎲 Генерация новых транзакций...");

    for (const driver of drivers) {
      let currentBalance = 0.0; // Начинаем с нуля, так как мы только что все сбросили
      const transactionsToCreate = [];

      // Генерируем случайное кол-во операций (от 5 до 20)
      const operationsCount = faker.number.int({ min: 5, max: 20 });

      // Дата начала истории (например, месяц назад)
      let transactionDate = faker.date.recent({ days: 30 });

      // 1. ГАРАНТИРОВАННОЕ ПЕРВОЕ ПОПОЛНЕНИЕ (ДЕПОЗИТ)
      // Чтобы водитель сразу мог работать
      const startDeposit = parseFloat(
        faker.finance.amount({ min: 1000, max: 5000, dec: 2 })
      );
      currentBalance += startDeposit;

      transactionsToCreate.push({
        id: faker.string.uuid(),
        driverId: driver.id,
        amount: startDeposit,
        type: "deposit",
        description: "Стартовое пополнение (Терминал)",
        balanceAfter: currentBalance, // Баланс стал равен депозиту
        createdAt: new Date(transactionDate.getTime() - 1000000),
        updatedAt: new Date(transactionDate.getTime() - 1000000),
      });

      // 2. СЛУЧАЙНЫЕ ОПЕРАЦИИ
      for (let i = 0; i < operationsCount; i++) {
        // Сдвигаем время вперед
        transactionDate = new Date(
          transactionDate.getTime() +
            faker.number.int({ min: 3600000, max: 86400000 })
        );

        const rand = Math.random();
        let type = "";
        let amount = 0;
        let description = "";
        let isPositive = false;

        // Логика вероятностей
        if (rand < 0.65) {
          // КОМИССИЯ (чаще всего)
          type = "order_commission";
          amount = parseFloat(
            faker.finance.amount({ min: 20, max: 150, dec: 2 })
          );
          description = `Комиссия заказа #${faker.number.int({
            min: 10000,
            max: 99999,
          })}`;
          isPositive = false;
        } else if (rand < 0.75) {
          // ШТРАФ
          type = "penalty";
          amount = parseFloat(
            faker.finance.amount({ min: 100, max: 500, dec: 2 })
          );
          description = faker.helpers.arrayElement([
            "Грязный салон",
            "Жалоба клиента",
            "Нарушение правил",
          ]);
          isPositive = false;
        } else if (rand < 0.85) {
          // БОНУС
          type = "bonus";
          amount = parseFloat(
            faker.finance.amount({ min: 50, max: 300, dec: 2 })
          );
          description = "Бонус за активность";
          isPositive = true;
        } else {
          // ПОПОЛНЕНИЕ (чтобы деньги не кончались)
          type = "deposit";
          amount = parseFloat(
            faker.finance.amount({ min: 500, max: 2000, dec: 2 })
          );
          description = "Пополнение баланса (Карта)";
          isPositive = true;
        }

        // Обновляем математический баланс
        if (isPositive) {
          currentBalance += amount;
        } else {
          currentBalance -= amount;
        }

        // Округляем до 2 знаков
        currentBalance = Math.round(currentBalance * 100) / 100;

        transactionsToCreate.push({
          id: faker.string.uuid(),
          driverId: driver.id,
          amount: amount,
          type: type,
          description: description,
          balanceAfter: currentBalance, // Важно! Записываем, сколько стало
          createdAt: transactionDate,
          updatedAt: transactionDate,
        });
      }

      // 3. СОХРАНЯЕМ В БД
      await DriverTransaction.bulkCreate(transactionsToCreate);

      // 4. ОБНОВЛЯЕМ ИТОГОВЫЙ БАЛАНС ВОДИТЕЛЯ
      await driver.update({ balance: currentBalance });

      console.log(
        `✅ ${driver.firstName} ${driver.lastName}: ${transactionsToCreate.length} операций. Баланс: ${currentBalance} с.`
      );
    }

    console.log("🏁 Все готово! История чистая, балансы сходятся.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  }
};

seedTransactions();
