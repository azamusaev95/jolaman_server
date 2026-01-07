import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

// @map: getOrCreateOrderChat (Создать/Найти Чат) -> orderId, clientId, driverId
export const getOrCreateOrderChat = async (req, res) => {
  try {
    const { orderId, clientId, driverId } = req.body;

    if (!orderId || !clientId || !driverId) {
      return res.status(400).json({
        message: "Нужно передать orderId, clientId и driverId",
      });
    }

    // Ищем существующий чат по заказу
    let chat = await Chat.findOne({
      where: { orderId },
      include: [
        { model: Client, as: "client", attributes: ["name", "phone"] },
        {
          model: Driver,
          as: "driver",
          attributes: ["firstName", "lastName", "phone"],
        },
        { model: Order, as: "order", attributes: ["publicNumber", "status"] },
      ],
    });

    if (!chat) {
      // Создаем новый чат под заказ
      const newChat = await Chat.create({
        type: "order",
        orderId,
        clientId,
        driverId,
        status: "active",
      });

      // Перезагружаем с данными связей
      chat = await Chat.findByPk(newChat.id, {
        include: [
          { model: Client, as: "client", attributes: ["name", "phone"] },
          {
            model: Driver,
            as: "driver",
            attributes: ["firstName", "lastName", "phone"],
          },
          { model: Order, as: "order", attributes: ["publicNumber", "status"] },
        ],
      });
    }

    return res.json(chat);
  } catch (e) {
    console.error("Error creating chat:", e);
    res.status(500).json({ message: "Ошибка при создании чата" });
  }
};

// @map: sendMessage (Отправить Сообщение)
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, content, contentType = "text" } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: "Не передан chatId" });
    }
    if (!senderId || !senderRole || !content) {
      return res.status(400).json({
        message: "Нужно передать senderId, senderRole и content",
      });
    }

    // Находим чат
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Чат не найден" });
    }

    // Проверяем только статус (TTL удален)
    if (chat.status === "closed") {
      return res.status(403).json({
        message: "Чат закрыт. Новые сообщения отправить нельзя.",
      });
    }

    // Создаём сообщение
    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    // Обновляем время последней активности в чате
    await Chat.update({ updatedAt: new Date() }, { where: { id: chatId } });

    return res.json(message);
  } catch (e) {
    console.error("Error sending message:", e);
    res.status(500).json({ message: "Ошибка отправки сообщения" });
  }
};

// @map: getChatMessages (Получить сообщения с метаданными чата)
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    if (!chatId) {
      return res.status(400).json({ message: "Не передан chatId" });
    }

    // 1. Получаем чат (авто-закрытие по TTL удалено)
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Чат не найден" });
    }

    // 2. Пагинация
    const numericLimit = Number(limit) || 50;
    const numericPage = Number(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    // 3. Получаем сообщения
    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: numericLimit,
      offset,
    });

    // 4. Помечаем как прочитанные
    if (userId) {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            chatId,
            isRead: false,
            senderId: { [Op.ne]: userId },
          },
        }
      );
    }

    return res.json({
      chat: {
        id: chat.id,
        type: chat.type,
        status: chat.status,
        title: chat.title,
        orderId: chat.orderId,
        clientId: chat.clientId,
        driverId: chat.driverId,
        adminId: chat.adminId,
        canReply:
          chat.status === "active" &&
          !["broadcast", "system"].includes(chat.type),
      },
      items: messages.rows,
      pagination: {
        total: messages.count,
        page: numericPage,
        limit: numericLimit,
        totalPages: Math.ceil(messages.count / numericLimit),
      },
    });
  } catch (e) {
    console.error("ERROR in getChatMessages:", e);
    res.status(500).json({
      message: "Ошибка загрузки сообщений",
      error: e.message,
    });
  }
};

// @map: getAllChats (Все Чаты для админ-панели)
export const getAllChats = async (req, res) => {
  try {
    const { orderId, status } = req.query;
    const where = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;

    const chats = await Chat.findAll({
      where,
      include: [
        {
          model: ChatMessage,
          as: "messages",
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
        { model: Client, as: "client", attributes: ["name", "phone"] },
        {
          model: Driver,
          as: "driver",
          attributes: ["firstName", "lastName", "phone"],
        },
        { model: Order, as: "order", attributes: ["publicNumber", "status"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    return res.json(chats);
  } catch (e) {
    console.error("Error fetching chats:", e);
    res.status(500).json({ message: "Ошибка загрузки списка чатов" });
  }
};

// @map: getDriverChats (Чаты конкретного водителя)
export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const { status } = req.query;

    /**
     * ЛОГИКА:
     * 1. Берем чаты водителя или общие рассылки.
     * 2. Если статус не указан, показываем всё кроме архива (active + closed).
     */
    const where = {
      [Op.or]: [{ driverId: driverId }, { type: "broadcast" }],
    };

    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.ne]: "archived" };
    }

    const chats = await Chat.findAll({
      where,
      include: [
        {
          model: ChatMessage,
          as: "messages",
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
        {
          model: Client,
          as: "client",
          attributes: ["name", "phone"],
        },
        {
          model: Driver,
          as: "driver",
          attributes: ["firstName", "lastName", "phone"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["publicNumber", "status"],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    return res.json(chats);
  } catch (e) {
    console.error("CRITICAL ERROR in getDriverChats:", e);
    res.status(500).json({
      message: "Ошибка загрузки списка чатов водителя",
      error: e.message,
    });
  }
};

/**
 * @map: createSupportChatWithDriver (Чат Водитель <-> Админ + Первое сообщение)
 * Создает чат типа support_driver и сразу добавляет сообщение.
 */
export const createSupportChatWithDriver = async (req, res) => {
  try {
    // Извлекаем данные. adminId теперь может быть null
    const { driverId, adminId, content, senderRole, senderId } = req.body;

    // ИСПРАВЛЕНО: Убрана обязательная проверка adminId
    if (!driverId || !content || !senderRole || !senderId) {
      return res.status(400).json({
        message: "Необходимы driverId, content, senderRole и senderId",
      });
    }

    /**
     * 1. Ищем существующий активный чат техподдержки для этого водителя.
     * Мы ищем чат, где:
     * - Тип support_driver
     * - driverId совпадает
     * - Статус active
     * - adminId совпадает ИЛИ он еще не назначен (null), если мы создаем новое обращение
     */
    let chat = await Chat.findOne({
      where: {
        type: "support_driver",
        driverId,
        status: "active",
        // Если пришел adminId, ищем с ним, если нет — ищем чат без админа
        adminId: adminId || null,
      },
    });

    // 2. Если активного чата нет, создаем новый
    if (!chat) {
      chat = await Chat.create({
        type: "support_driver",
        driverId,
        adminId: adminId || null, // Сохраняем null, если админ не передан
        status: "active",
        title: `Поддержка: Водитель ID ${driverId.slice(0, 8)}`,
      });
    }

    // 3. Создаем сообщение в этом чате
    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId,
      senderRole,
      content,
      contentType: "text",
    });

    // 4. Обновляем updatedAt чата, чтобы он поднялся в списке у админа и водителя
    await chat.update({ updatedAt: new Date() });

    return res.status(201).json({
      chat,
      message,
    });
  } catch (e) {
    console.error("Error in createSupportChatWithDriver:", e);
    res.status(500).json({
      message: "Ошибка при создании чата с поддержкой",
      error: e.message,
    });
  }
};
