import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

/**
 * Вспомогательная функция отправки сообщения через сокет
 */
const emitSocketMessage = (req, chatId, message) => {
  try {
    const io = req.app.get("io");
    if (io) {
      const roomName = String(chatId); // Гарантируем строку
      console.log(
        `📡 [SOCKET EMIT] Sending 'new_message' to room: ${roomName}`
      );
      io.to(roomName).emit("new_message", message);
    } else {
      console.error("❌ [SOCKET ERROR] IO instance not found in req.app");
    }
  } catch (err) {
    console.error("❌ [SOCKET ERROR] Emit failed:", err);
  }
};

// @map: getOrCreateOrderChat
export const getOrCreateOrderChat = async (req, res) => {
  try {
    const { orderId, clientId, driverId } = req.body;

    if (!orderId || !clientId || !driverId) {
      return res.status(400).json({
        message: "Нужно передать orderId, clientId и driverId",
      });
    }

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
      const newChat = await Chat.create({
        type: "order",
        orderId,
        clientId,
        driverId,
        status: "active",
      });

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

// @map: sendMessage
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, content, contentType = "text" } = req.body;

    if (!chatId) return res.status(400).json({ message: "Не передан chatId" });
    if (!senderId || !senderRole || !content) {
      return res.status(400).json({ message: "Неполные данные" });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Чат не найден" });

    if (chat.status === "closed") {
      return res.status(403).json({ message: "Чат закрыт" });
    }

    // Создаём сообщение в БД
    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    // Обновляем время чата
    await Chat.update({ updatedAt: new Date() }, { where: { id: chatId } });

    // 🔥 REAL-TIME PUSH
    emitSocketMessage(req, chatId, message);

    return res.json(message);
  } catch (e) {
    console.error("Error sending message:", e);
    res.status(500).json({ message: "Ошибка отправки сообщения" });
  }
};

// @map: getChatMessages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    if (!chatId) return res.status(400).json({ message: "Не передан chatId" });

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Чат не найден" });

    const numericLimit = Number(limit) || 50;
    const numericPage = Number(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: numericLimit,
      offset,
    });

    // Помечаем как прочитанные
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
    res.status(500).json({ message: "Ошибка", error: e.message });
  }
};

// @map: getAllChats
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
    res.status(500).json({ message: "Ошибка" });
  }
};

// @map: getDriverChats
export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;
    if (!driverId) return res.status(401).json({ message: "Не авторизован" });

    const { status } = req.query;
    const where = {
      [Op.or]: [{ driverId: driverId }, { type: "broadcast" }],
    };

    if (status) where.status = status;
    else where.status = { [Op.ne]: "archived" };

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
    console.error("Error getDriverChats:", e);
    res.status(500).json({ message: "Ошибка", error: e.message });
  }
};

// @map: createSupportChatWithDriver
export const createSupportChatWithDriver = async (req, res) => {
  try {
    const { driverId, adminId, content, senderRole, senderId } = req.body;

    if (!driverId || !content || !senderRole || !senderId) {
      return res.status(400).json({ message: "Неполные данные" });
    }

    let chat = await Chat.findOne({
      where: {
        type: "support_driver",
        driverId,
        status: "active",
        adminId: adminId || null,
      },
    });

    if (!chat) {
      chat = await Chat.create({
        type: "support_driver",
        driverId,
        adminId: adminId || null,
        status: "active",
        title: `Поддержка: Водитель ID ${driverId.slice(0, 8)}`,
      });
    }

    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId,
      senderRole,
      content,
      contentType: "text",
    });

    await chat.update({ updatedAt: new Date() });

    // 🔥 REAL-TIME PUSH
    emitSocketMessage(req, chat.id, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    console.error("Error createSupportChatWithDriver:", e);
    res.status(500).json({ message: "Ошибка", error: e.message });
  }
};
