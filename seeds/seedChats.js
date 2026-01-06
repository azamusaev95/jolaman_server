import sequelize from "../config/db.js";
import { fakerRU as faker } from "@faker-js/faker";
import { Op } from "sequelize";

// 👇 Импортируем модели
import Chat from "../features/chat/chat.model.js";
import ChatMessage from "../features/chatMessage/chatMessage.model.js";
import Order from "../features/order/order.model.js";
import Client from "../features/client/client.model.js";
import Driver from "../features/driver/driver.model.js";
import User from "../features/user/user.model.js";

const seedChats = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // 1. Синхронизация таблиц
    console.log("⏳ Синхронизация таблиц...");
    await sequelize.sync({ alter: true });

    // 2. Сбор данных
    const drivers = await Driver.findAll({ attributes: ["id"] });
    const clients = await Client.findAll({ attributes: ["id"] });
    const orders = await Order.findAll({
      where: { driverId: { [Op.ne]: null } },
      attributes: ["id", "clientId", "driverId"],
    });
    const admins = await User.findAll({
      where: { role: ["admin", "dispatcher", "superadmin"] },
      attributes: ["id"],
    });

    if (drivers.length === 0 || clients.length === 0) {
      console.error("❌ Ошибка: Сначала создайте водителей и клиентов!");
      process.exit(1);
    }

    const adminId = admins.length > 0 ? admins[0].id : null;

    console.log(
      `🚀 Начинаем генерацию: ${drivers.length} водителей x 10 чатов каждого.`
    );

    // 3. Создаем ГЛОБАЛЬНЫЕ BROADCAST чаты (их видят все водители)
    console.log("📢 Создаем глобальные Broadcast сообщения...");
    const broadcastTitles = [
      "Обновление тарифов с завтрашнего дня",
      "Бонус +10% за заказы в ночное время",
      "Технические работы в приложении 07.01",
      "Новые правила работы с корпоративными клиентами",
      "Поздравляем с праздниками!",
    ];

    for (const title of broadcastTitles) {
      await Chat.create(
        {
          type: "broadcast",
          status: "active",
          title: title,
          messages: [
            {
              senderRole: "admin",
              senderId: adminId,
              content: `Уважаемые водители! ${title}. Подробности в разделе новостей.`,
              contentType: "text",
              isRead: false,
            },
          ],
        },
        {
          include: [{ model: ChatMessage, as: "messages" }],
        }
      );
    }

    // 4. Генерируем по 10 персональных чатов для КАЖДОГО водителя
    for (const driver of drivers) {
      console.log(`📡 Создание чатов для водителя: ${driver.id}`);

      for (let i = 0; i < 10; i++) {
        let chatData = {
          status: "active",
          driverId: driver.id,
        };
        let participants = [];

        // Распределяем типы: 50% заказы, 30% поддержка, 20% системные
        const rand = Math.random();

        if (rand < 0.5 && orders.length > 0) {
          // --- ТИП: ORDER ---
          const driverOrders = orders.filter((o) => o.driverId === driver.id);
          const order =
            driverOrders.length > 0
              ? faker.helpers.arrayElement(driverOrders)
              : faker.helpers.arrayElement(orders);

          chatData.type = "order";
          chatData.orderId = order.id;
          chatData.clientId = order.clientId;
          participants = [
            { role: "client", id: order.clientId },
            { role: "driver", id: driver.id },
          ];
        } else if (rand < 0.8) {
          // --- ТИП: SUPPORT_DRIVER ---
          chatData.type = "support_driver";
          chatData.adminId = adminId;
          participants = [
            { role: "driver", id: driver.id },
            { role: "admin", id: adminId },
          ];
        } else {
          // --- ТИП: SYSTEM ---
          chatData.type = "system";
          chatData.title = faker.helpers.arrayElement([
            "Штраф за отмену заказа",
            "Выплата успешно проведена",
            "Ваш рейтинг повысился",
            "Документы проверены",
          ]);
          participants = [
            { role: "admin", id: adminId }, // Системные обычно от админа/робота
          ];
        }

        // Генерируем сообщения для этого чата
        const messagesCount = faker.number.int({ min: 2, max: 8 });
        const messagesData = [];
        let msgTime = faker.date.recent({ days: 3 });

        for (let m = 0; m < messagesCount; m++) {
          const sender =
            participants.length > 1
              ? faker.helpers.arrayElement(
                  participants.filter((p) => p.id !== null)
                )
              : { role: "admin", id: adminId };

          let content = "";
          if (chatData.type === "order") {
            content =
              sender.role === "client"
                ? faker.helpers.arrayElement([
                    "Я выхожу",
                    "Где вы?",
                    "Подъедьте ближе",
                    "Ок",
                    "Вижу вас",
                  ])
                : faker.helpers.arrayElement([
                    "Уже на месте",
                    "Жду вас",
                    "Тут пробка",
                    "Хорошо",
                    "Здравствуйте",
                  ]);
          } else if (chatData.type === "support_driver") {
            content =
              sender.role === "admin"
                ? faker.helpers.arrayElement([
                    "Ожидайте ответа",
                    "Мы проверяем",
                    "Проблема решена",
                    "Пришлите фото",
                  ])
                : faker.helpers.arrayElement([
                    "Не работает кнопка",
                    "Ошибка оплаты",
                    "Как сменить авто?",
                    "Спасибо",
                  ]);
          } else {
            content = `Системное уведомление: ${chatData.title}. Проверьте ваш баланс или историю.`;
          }

          msgTime = new Date(msgTime.getTime() + m * 600000); // Разрыв 10 минут

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

        // Сохраняем чат с сообщениями
        await Chat.create(
          {
            ...chatData,
            messages: messagesData,
          },
          {
            include: [{ model: ChatMessage, as: "messages" }],
          }
        );
      }
    }

    console.log(
      "✅ Успех: Все водители получили по 10 активных чатов + Broadcast!"
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при заполнении БД:", error);
    process.exit(1);
  }
};

seedChats();
