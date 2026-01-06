import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

// === Константы TTL для авто-закрытия чатов ===
const CHAT_TTL_HOURS = 4;
const CHAT_TTL_MS = CHAT_TTL_HOURS * 60 * 60 * 1000;

const isChatExpired = (lastActivity) => {
  if (!lastActivity) return false;
  const ts = new Date(lastActivity).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > CHAT_TTL_MS;
};

// @map: getOrCreateOrderChat (Создать/Найти Чат) -> orderId, clientId, driverId, type, status [Public/Auth]
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

// @map: sendMessage (Отправить Сообщение) -> id [Auth/Driver/Client]
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

    // Проверяем TTL (по updatedAt чата или последнему сообщению)
    // Можно использовать только chat.updatedAt, так как мы его обновляем на каждый send
    const lastActivity = chat.updatedAt || chat.createdAt;
    const expired = isChatExpired(lastActivity);

    if (expired || chat.status === "closed") {
      // Если чат ещё не помечен как closed — пометим
      if (chat.status !== "closed") {
        await Chat.update({ status: "closed" }, { where: { id: chatId } });
      }

      return res.status(403).json({
        message:
          "Чат закрыт: прошло более 4 часов без активности. Новые сообщения отправить нельзя.",
      });
    }

    // Чат ещё активен — создаём сообщение
    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    // Обновляем updatedAt и убеждаемся, что статус активный
    await Chat.update(
      { updatedAt: new Date(), status: "active" },
      { where: { id: chatId } }
    );

    return res.json(message);
  } catch (e) {
    console.error("Error sending message:", e);
    res.status(500).json({ message: "Ошибка отправки сообщения" });
  }
};

// @map: getChatMessages (История Сообщений) -> id [Auth]
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!chatId) {
      return res.status(400).json({ message: "Не передан chatId" });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Чат не найден" });
    }

    // Мягкая синхронизация статуса по TTL (историю смотреть можно всегда)
    const expired = isChatExpired(chat.updatedAt || chat.createdAt);
    if (expired && chat.status !== "closed") {
      await Chat.update({ status: "closed" }, { where: { id: chatId } });
    }

    const numericLimit = Number(limit) || 50;
    const numericPage = Number(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: numericLimit,
      offset,
    });

    return res.json({
      items: messages.rows,
      total: messages.count,
      page: numericPage,
      limit: numericLimit,
      chatStatus: expired ? "closed" : chat.status,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка загрузки сообщений" });
  }
};

// @map: getAllChats (Все Чаты) -> orderId, clientId, driverId, status [Admin/Dispatcher]
export const getAllChats = async (req, res) => {
  try {
    const { orderId, status } = req.query;
    const where = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status; // active | closed | ...

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

// @map: getDriverChats (Чаты конкретного водителя) -> driverId [Driver]
export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId) {
      console.log("DEBUG: Driver ID not found in req.user");
      return res.status(401).json({ message: "Не авторизован" });
    }

    const { status } = req.query;

    /**
     * ЛОГИКА:
     * 1. Берем чаты, где driverId совпадает (order, support, system)
     * 2. ИЛИ берем чаты типа 'broadcast' (они для всех)
     * 3. Обязательно фильтруем по статусу (по умолчанию active)
     */
    const where = {
      status: status || "active",
      [Op.or]: [{ driverId: driverId }, { type: "broadcast" }],
    };

    console.log(
      "DEBUG: Searching chats with where clause:",
      JSON.stringify(where)
    );

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

    console.log(`DEBUG: Found ${chats.length} chats`);

    // Возвращаем найденные чаты вместо пустого массива
    return res.json(chats);
  } catch (e) {
    console.error("CRITICAL ERROR in getDriverChats:", e);
    res.status(500).json({
      message: "Ошибка загрузки списка чатов водителя",
      error: e.message,
    });
  }
};
