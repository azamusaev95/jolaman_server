import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

/**
 * Отправляет сообщение и участникам чата, и всем админам
 */
const emitSocketMessage = (req, chatId, message) => {
  try {
    const io = req.app.get("io");
    if (io) {
      const roomName = String(chatId);

      // 1. Отправляем в комнату чата (Водителю/Клиенту)
      io.to(roomName).emit("new_message", message);

      // 2. Отправляем в глобальный канал админов
      io.to("admins").emit("new_message", message);

      console.log(`📡 [SOCKET] Broadcasted to room '${roomName}' AND 'admins'`);
    } else {
      console.error("❌ [SOCKET ERROR] IO not found");
    }
  } catch (err) {
    console.error("❌ [SOCKET ERROR]", err);
  }
};

// @map: getOrCreateOrderChat
export const getOrCreateOrderChat = async (req, res) => {
  try {
    const { orderId, clientId, driverId } = req.body;

    if (!orderId || !clientId || !driverId) {
      return res.status(400).json({ message: "Неполные данные" });
    }

    let chat = await Chat.findOne({
      where: { orderId },
      include: [
        { model: Client, as: "client" },
        { model: Driver, as: "driver" },
        { model: Order, as: "order" },
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
          { model: Client, as: "client" },
          { model: Driver, as: "driver" },
          { model: Order, as: "order" },
        ],
      });
    }

    return res.json(chat);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};

// @map: sendMessage
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, content, contentType = "text" } = req.body;

    if (!chatId) return res.status(400).json({ message: "No chatId" });
    if (!content) return res.status(400).json({ message: "No content" });

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (chat.status === "closed") {
      return res.status(403).json({ message: "Chat closed" });
    }

    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    await Chat.update({ updatedAt: new Date() }, { where: { id: chatId } });

    // 🔥 ОТПРАВКА СОКЕТА
    emitSocketMessage(req, chatId, message);

    return res.json(message);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Send error" });
  }
};

// @map: getChatMessages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    const numericLimit = Number(limit) || 50;
    const offset = (Number(page) - 1) * numericLimit;

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: numericLimit,
      offset,
    });

    if (userId) {
      await ChatMessage.update(
        { isRead: true },
        { where: { chatId, isRead: false, senderId: { [Op.ne]: userId } } }
      );
    }

    return res.json({
      chat,
      items: messages.rows,
      pagination: {
        total: messages.count,
        page: Number(page),
        limit: numericLimit,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error fetching messages" });
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
    res.status(500).json({ message: "Error" });
  }
};

// @map: getDriverChats
export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;
    const { status } = req.query;
    const where = { [Op.or]: [{ driverId }, { type: "broadcast" }] };

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
        { model: Client, as: "client" },
        { model: Driver, as: "driver" },
        { model: Order, as: "order" },
      ],
      order: [["updatedAt", "DESC"]],
    });

    return res.json(chats);
  } catch (e) {
    res.status(500).json({ message: "Error" });
  }
};

// @map: createSupportChatWithDriver
export const createSupportChatWithDriver = async (req, res) => {
  try {
    const { driverId, adminId, content, senderRole, senderId } = req.body;

    let chat = await Chat.findOne({
      where: { type: "support_driver", driverId, status: "active" },
    });

    if (!chat) {
      chat = await Chat.create({
        type: "support_driver",
        driverId,
        adminId: adminId || null,
        status: "active",
        title: `Поддержка`,
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

    // 🔥 ОТПРАВКА СОКЕТА
    emitSocketMessage(req, chat.id, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};
