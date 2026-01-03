import sequelize from "../config/db.js";
import { fakerRU as faker } from "@faker-js/faker";

// 👇 Импортируем модели (Проверь свои пути!)
// Если используешь index.js: import { Chat, ChatMessage, Order, Client, Driver, User } from "./src/models/index.js";
// Или напрямую из features:
import Chat from "../features/chat/chat.model.js";
import ChatMessage from "../features/chatMessage/chatMessage.model.js";
import Order from "../features/order/order.model.js";
import Client from "../features/client/client.model.js";
import Driver from "../features/driver/driver.model.js";
import User from "../features/user/user.model.js"; // Админы/Диспетчеры

const seedChats = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // 1. Создаем таблицы, если их нет
    console.log("⏳ Синхронизация таблиц (Chat, ChatMessage)...");
    await sequelize.sync({ alter: true });

    // 2. Получаем реальные данные для привязки
    const orders = await Order.findAll({
      attributes: ["id", "clientId", "driverId"],
    });
    const clients = await Client.findAll({ attributes: ["id"] });
    const drivers = await Driver.findAll({ attributes: ["id"] });
    // Ищем админа или диспетчера, чтобы он отвечал в техподдержке
    const admins = await User.findAll({
      where: { role: ["admin", "dispatcher", "superadmin"] },
      attributes: ["id"],
    });

    if (orders.length === 0 || clients.length === 0) {
      console.error(
        "❌ Ошибка: Сначала создай Заказы и Клиентов (npm run seed:orders)"
      );
      process.exit(1);
    }

    const adminId = admins.length > 0 ? admins[0].id : null; // Берем первого админа для ответов
    console.log(
      `📊 База: ${orders.length} заказов, ${
        clients.length
      } клиентов, админ ID: ${adminId || "нет"}`
    );

    const CHAT_COUNT = 100;
    console.log(`🚀 Создаем ${CHAT_COUNT} чатов с перепиской...`);

    for (let i = 0; i < CHAT_COUNT; i++) {
      // 🎲 Решаем, какой это будет чат:
      // 70% - чат по заказу (Client <-> Driver)
      // 30% - чат с поддержкой (Client/Driver <-> Admin)
      const isOrderChat = Math.random() > 0.3;

      let chatData = {};
      let participants = []; // Массив участников для генерации сообщений

      if (isOrderChat && orders.length > 0) {
        // --- ЧАТ ПО ЗАКАЗУ ---
        const randomOrder = orders[Math.floor(Math.random() * orders.length)];

        // Если у заказа нет водителя, чат создавать странно, но допустим клиент пишет в пустоту или диспетчеру
        // Для упрощения берем заказы с водителем, если есть
        if (!randomOrder.driverId) continue;

        chatData = {
          type: "order",
          status: "active",
          orderId: randomOrder.id,
          clientId: randomOrder.clientId,
          driverId: randomOrder.driverId,
        };

        participants = [
          { role: "client", id: randomOrder.clientId },
          { role: "driver", id: randomOrder.driverId },
        ];
      } else {
        // --- ЧАТ ПОДДЕРЖКИ ---
        // Либо клиент пишет, либо водитель
        const isClientSupport = Math.random() > 0.5;

        if (isClientSupport) {
          const randomClient =
            clients[Math.floor(Math.random() * clients.length)];
          chatData = {
            type: "support_client",
            status: "active",
            clientId: randomClient.id,
            adminId: adminId, // Может быть null, если админ еще не взял чат
          };
          participants = [
            { role: "client", id: randomClient.id },
            { role: "admin", id: adminId }, // Если adminId null, сообщения от админа не будет
          ];
        } else if (drivers.length > 0) {
          const randomDriver =
            drivers[Math.floor(Math.random() * drivers.length)];
          chatData = {
            type: "support_driver",
            status: "active",
            driverId: randomDriver.id,
            adminId: adminId,
          };
          participants = [
            { role: "driver", id: randomDriver.id },
            { role: "admin", id: adminId },
          ];
        } else {
          continue; // Нет драйверов
        }
      }

      // 💬 ГЕНЕРИРУЕМ СООБЩЕНИЯ (от 3 до 8 штук)
      const messagesCount = faker.number.int({ min: 3, max: 8 });
      const messagesData = [];

      // Базовое время (например, пару часов назад)
      let msgTime = faker.date.recent({ days: 2 });

      for (let m = 0; m < messagesCount; m++) {
        // Выбираем, кто пишет (по очереди или случайно)
        const sender = participants[m % participants.length];

        // Если у нас нет ID отправителя (например, нет админа), пропускаем
        if (!sender.id) continue;

        // Текст сообщения
        let content = "";
        if (chatData.type === "order") {
          content =
            sender.role === "client"
              ? faker.helpers.arrayElement([
                  "Где вы?",
                  "Я выхожу",
                  "Подъедьте к 3 подъезду",
                  "Скоро будете?",
                  "Оплата картой?",
                ])
              : faker.helpers.arrayElement([
                  "Подъезжаю",
                  "Стою у шлагбаума",
                  "Выходите",
                  "Пробки 5 баллов",
                  "Ок",
                ]);
        } else {
          content =
            sender.role === "admin"
              ? faker.helpers.arrayElement([
                  "Здравствуйте, чем могу помочь?",
                  "Минуту, проверяю",
                  "Заказ отменен",
                  "Спасибо за обращение",
                ])
              : faker.helpers.arrayElement([
                  "Не могу закрыть заказ",
                  "Клиент не вышел",
                  "Забыл вещи в машине",
                  "Неверно посчитало цену",
                ]);
        }

        // Сдвигаем время каждого следующего сообщения на 1-5 минут
        msgTime = new Date(
          msgTime.getTime() + faker.number.int({ min: 1, max: 5 }) * 60000
        );

        messagesData.push({
          senderId: sender.id,
          senderRole: sender.role,
          content: content,
          contentType: "text",
          isRead: true,
          createdAt: msgTime,
          updatedAt: msgTime,
        });
      }

      // СОХРАНЯЕМ В БД (Чат + Сообщения)
      await Chat.create(
        {
          ...chatData,
          messages: messagesData,
        },
        {
          include: [{ model: ChatMessage, as: "messages" }], // Важно! Убедись, что в chat.model.js прописано hasMany(..., {as: 'messages'})
        }
      );
    }

    console.log("✅ Готово! Чаты и сообщения созданы.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  }
};

seedChats();
