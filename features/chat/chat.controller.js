import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

const READ_ONLY_TYPES = new Set([
  "broadcast_driver",
  "broadcast_client",
  "system_driver",
  "system_client",
]);

// ======================================================
// SOCKET HELPERS
// ======================================================

const emitSocketMessage = (req, chatId, message) => {
  try {
    const io = req.app.get("io");
    if (!io) return;

    const roomName = String(chatId);
    io.to(roomName).emit("new_message", message);
    io.to("admins").emit("new_message", message);

    console.log(`📡 [SOCKET] New message in chat ${chatId}`);
  } catch (err) {
    console.error("❌ [SOCKET ERROR]", err);
  }
};

const emitAudiencePush = (req, chat, message) => {
  try {
    const io = req.app.get("io");
    if (!io) return;

    if (chat.type === "broadcast_driver") {
      io.to("drivers").emit("new_message", message);
    } else if (chat.type === "broadcast_client") {
      io.to("clients").emit("new_message", message);
    } else if (chat.type === "system_driver" && chat.driverId) {
      io.to(`driver:${chat.driverId}`).emit("new_message", message);
    } else if (chat.type === "system_client" && chat.clientId) {
      io.to(`client:${chat.clientId}`).emit("new_message", message);
    }
  } catch (e) {
    console.error("❌ [SOCKET PUSH ERROR]", e);
  }
};

// ======================================================
// READ-STATE HELPERS
// ======================================================

// Помощник для определения роли
const resolveActorRole = (req, chat, senderRole) => {
  if (
    senderRole &&
    ["driver", "client", "admin", "system"].includes(senderRole)
  ) {
    return senderRole === "system" ? "admin" : senderRole;
  }
  const userId = req.user?.id;
  if (userId && chat?.driverId === userId) return "driver";
  if (userId && chat?.clientId === userId) return "client";
  return "admin";
};

// Помощник для подготовки объекта обновления даты прочтения
const getReadAtUpdateObject = (chat, actorRole) => {
  if (!chat) return {};
  const now = new Date();
  const isBroadcast =
    chat.type === "broadcast_driver" || chat.type === "broadcast_client";

  if (isBroadcast) {
    return actorRole === "admin" ? { adminLastReadAt: now } : {};
  }

  if (actorRole === "driver") return { driverLastReadAt: now };
  if (actorRole === "client") return { clientLastReadAt: now };
  return { adminLastReadAt: now };
};

// ======================================================
// CONTROLLERS
// ======================================================

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
    res.status(500).json({ message: "Error" });
  }
};

// @map: sendMessage
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, content, contentType = "text" } = req.body;

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (READ_ONLY_TYPES.has(chat.type) || chat.status === "closed") {
      return res.status(403).json({ message: "Action not allowed" });
    }

    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    // ИЗМЕНЕНО: Обновляем статус прочтения отправителя и время чата за один раз
    const actorRole = resolveActorRole(req, chat, senderRole);
    const readUpdate = getReadAtUpdateObject(chat, actorRole);

    await chat.update({ ...readUpdate, updatedAt: new Date() });

    emitSocketMessage(req, chatId, message);
    return res.json(message);
  } catch (e) {
    res.status(500).json({ message: "Send error" });
  }
};

// @map: getChatMessages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: Number(limit) || 50,
      offset: (Number(page) - 1) * (Number(limit) || 50),
    });

    // Помечаем сообщения прочитанными
    if (userId) {
      await ChatMessage.update(
        { isRead: true },
        { where: { chatId, isRead: false, senderId: { [Op.ne]: userId } } }
      );
    }

    // ✅ ИЗМЕНЕНО: Прямое обновление driverLastReadAt без resolveActorRole для скорости
    const updatePayload = { updatedAt: new Date() };

    if (userId && chat.driverId === userId) {
      updatePayload.driverLastReadAt = new Date();
      console.log(`✅ [READ] Driver ${userId} read chat ${chatId}`);
    } else {
      // Логика для других ролей
      const actorRole = resolveActorRole(req, chat, null);
      const readData = getReadAtUpdateObject(chat, actorRole);
      Object.assign(updatePayload, readData);
    }

    // ИЗМЕНЕНО: Атомарное обновление даты прочтения и даты обновления чата
    await chat.update(updatePayload);

    const freshChat = await Chat.findByPk(chatId);
    const canReply =
      chat.status !== "closed" && !READ_ONLY_TYPES.has(chat.type);

    return res.json({
      chat: { ...freshChat.toJSON(), canReply },
      items: messages.rows,
      pagination: {
        total: messages.count,
        page: Number(page),
        limit: Number(limit) || 50,
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Error" });
  }
};

// @map: getDriverChats
export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;
    if (!driverId) return res.status(401).json({ message: "Unauthorized" });

    const chats = await Chat.findAll({
      where: {
        [Op.or]: [
          { driverId },
          { type: "broadcast_driver" },
          { type: "system_driver", driverId },
        ],
      },
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
        title: "Поддержка",
      });
    }

    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId,
      senderRole,
      content,
      contentType: "text",
    });

    // ИЗМЕНЕНО: Атомарное обновление при создании сообщения в поддержке
    const actorRole = resolveActorRole(req, chat, senderRole);
    const readUpdate = getReadAtUpdateObject(chat, actorRole);
    await chat.update({ ...readUpdate, updatedAt: new Date() });

    emitSocketMessage(req, chat.id, message);
    return res.status(201).json({ chat, message });
  } catch (e) {
    res.status(500).json({ message: "Error" });
  }
};

// @map: createBroadcastChat
export const createBroadcastChat = async (req, res) => {
  try {
    const { target, title, content, senderId, senderRole } = req.body;
    const type = target === "driver" ? "broadcast_driver" : "broadcast_client";

    const chat = await Chat.create({
      type,
      status: "active",
      title: title || null,
      adminLastReadAt: new Date(),
    });
    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId,
      senderRole: senderRole || "admin",
      content,
    });

    await chat.update({ updatedAt: new Date() });
    emitSocketMessage(req, chat.id, message);
    emitAudiencePush(req, chat, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    res.status(500).json({ message: "Error" });
  }
};

// @map: createSystemChat
export const createSystemChat = async (req, res) => {
  try {
    const { target, driverId, clientId, title, content, senderId, senderRole } =
      req.body;
    const type = target === "driver" ? "system_driver" : "system_client";

    const chat = await Chat.create({
      type,
      status: "active",
      title: title || "Система",
      driverId: target === "driver" ? driverId : null,
      clientId: target === "client" ? clientId : null,
      adminLastReadAt: new Date(),
    });

    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId,
      senderRole: senderRole || "system",
      content,
    });

    await chat.update({ updatedAt: new Date() });
    emitSocketMessage(req, chat.id, message);
    emitAudiencePush(req, chat, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    res.status(500).json({ message: "Error" });
  }
};

// @map: getAllChats (Admin List)
export const getAllChats = async (req, res) => {
  try {
    const { orderId, status, type } = req.query;
    const where = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;
    if (type) where.type = type;

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
