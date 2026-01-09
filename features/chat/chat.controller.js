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

/**
 * Отправляет сообщение:
 * - в комнату конкретного чата (chatId)
 * - в глобальный канал админов
 */
const emitSocketMessage = (req, chatId, message) => {
  try {
    const io = req.app.get("io");
    if (!io) {
      console.error("❌ [SOCKET ERROR] IO not found");
      return;
    }

    const roomName = String(chatId);

    io.to(roomName).emit("new_message", message);
    io.to("admins").emit("new_message", message);

    console.log(`📡 [SOCKET] Broadcasted to room '${roomName}' AND 'admins'`);
  } catch (err) {
    console.error("❌ [SOCKET ERROR]", err);
  }
};

/**
 * Пуш для рассылок/системных:
 * - broadcast_driver -> room "drivers"
 * - broadcast_client -> room "clients"
 * - system_driver -> room `driver:<id>`
 * - system_client -> room `client:<id>`
 */
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
    console.error("❌ [SOCKET AUDIENCE PUSH ERROR]", e);
  }
};

// ======================================================
// READ-STATE HELPERS
// ======================================================

/**
 * Определяем роль действующего лица (кто открыл чат / кто отправил сообщение):
 * - если есть senderRole (в body) — используем его
 * - иначе сравниваем req.user.id с chat.driverId/chat.clientId
 * - иначе считаем admin
 *
 * Возвращает: "driver" | "client" | "admin"
 */
const resolveActorRole = (req, chat, senderRole) => {
  const roleFromBody = typeof senderRole === "string" ? senderRole : null;

  if (
    roleFromBody &&
    ["driver", "client", "admin", "system"].includes(roleFromBody)
  ) {
    return roleFromBody === "system" ? "admin" : roleFromBody;
  }

  const userId = req.user?.id;
  if (userId && chat?.driverId && String(chat.driverId) === String(userId))
    return "driver";
  if (userId && chat?.clientId && String(chat.clientId) === String(userId))
    return "client";

  return "admin";
};

/**
 * Обновляем lastReadAt по роли.
 * ВАЖНО: для broadcast_* нельзя ставить driver/client lastReadAt (иначе "прочитал один = прочитали все").
 * Для broadcast разрешаем обновлять только adminLastReadAt.
 */
const touchChatReadAt = async (chat, actorRole) => {
  if (!chat) return;

  const now = new Date();
  const isBroadcast =
    chat.type === "broadcast_driver" || chat.type === "broadcast_client";

  if (isBroadcast) {
    if (actorRole === "admin") {
      await chat.update({ adminLastReadAt: now });
    }
    return;
  }

  if (actorRole === "driver") {
    await chat.update({ driverLastReadAt: now });
  } else if (actorRole === "client") {
    await chat.update({ clientLastReadAt: now });
  } else {
    await chat.update({ adminLastReadAt: now });
  }
};

// ======================================================
// ORDER CHAT
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
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};

// ======================================================
// SEND MESSAGE (обычные чаты)
// ======================================================

// @map: sendMessage
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, content, contentType = "text" } = req.body;

    if (!chatId) return res.status(400).json({ message: "No chatId" });
    if (!content) return res.status(400).json({ message: "No content" });

    const chat = await Chat.findByPk(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // ✅ Запрет на ответы в broadcast/system_* на уровне API
    if (READ_ONLY_TYPES.has(chat.type)) {
      return res
        .status(403)
        .json({ message: "Replies are not allowed in this chat" });
    }

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

    // Поднимаем чат в списках
    await Chat.update({ updatedAt: new Date() }, { where: { id: chatId } });

    // ✅ Отправитель сам "видел" чат
    const actorRole = resolveActorRole(req, chat, senderRole);
    await touchChatReadAt(chat, actorRole);

    // 🔥 сокеты
    emitSocketMessage(req, chatId, message);

    return res.json(message);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Send error" });
  }
};

// ======================================================
// GET MESSAGES
// ======================================================

export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id; // ID текущего пользователя из токена

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

    // Помечаем все сообщения в чате как прочитанные (isRead = true)
    if (userId) {
      await ChatMessage.update(
        { isRead: true },
        { where: { chatId, isRead: false, senderId: { [Op.ne]: userId } } }
      );
    }

    // ✅ ИЗМЕНЕНО: Прямое обновление статуса прочтения для ВОДИТЕЛЯ
    // Больше не используем resolveActorRole. Проверяем напрямую:
    if (userId && chat.driverId && String(chat.driverId) === String(userId)) {
      // ИЗМЕНЕНО: Обновляем driverLastReadAt и updatedAt ОДНИМ запросом, чтобы время совпало
      await chat.update({
        driverLastReadAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(
        `✅ [READ_STATUS] driverLastReadAt updated for chat ${chatId}`
      );
    }

    const canReply =
      chat.status !== "closed" &&
      ![
        "broadcast_driver",
        "broadcast_client",
        "system_driver",
        "system_client",
      ].includes(chat.type);

    // Берем свежие данные чата после обновления
    const freshChat = await Chat.findByPk(chatId);

    return res.json({
      chat: {
        ...freshChat.toJSON(),
        canReply,
      },
      items: messages.rows,
      pagination: {
        total: messages.count,
        page: Number(page),
        limit: numericLimit,
      },
    });
  } catch (e) {
    console.error("❌ Error in getChatMessages:", e);
    res.status(500).json({ message: "Error fetching messages" });
  }
};
// ======================================================
// LIST CHATS (admin)
// ======================================================

// @map: getAllChats
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

// ======================================================
// LIST CHATS (driver app)
// ======================================================

export const getDriverChats = async (req, res) => {
  try {
    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({ message: "Пользователь не авторизован" });
    }

    const where = {
      [Op.or]: [
        { driverId },
        { type: "broadcast_driver" },
        { type: "system_driver", driverId },
      ],
    };

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
      // Сортируем так, чтобы последние обновленные были сверху
      order: [["updatedAt", "DESC"]],
    });

    return res.json(chats);
  } catch (e) {
    console.error("❌ ERROR in getDriverChats:", e);
    res.status(500).json({
      message: "Ошибка при получении всех чатов",
      error: e.message,
    });
  }
};

// ======================================================
// SUPPORT DRIVER
// ======================================================

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

    await chat.update({ updatedAt: new Date() });

    // ✅ Отправитель сам "видел" чат
    const actorRole = resolveActorRole(req, chat, senderRole);
    await touchChatReadAt(chat, actorRole);

    emitSocketMessage(req, chat.id, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};

// ======================================================
// NEW: BROADCAST (отдельный чат на каждую рассылку)
// ======================================================

// @map: createBroadcastChat
export const createBroadcastChat = async (req, res) => {
  try {
    const {
      target, // "driver" | "client"
      title,
      content,
      adminId,
      senderId,
      senderRole,
      contentType = "text",
    } = req.body;

    if (!target || !["driver", "client"].includes(target)) {
      return res.status(400).json({ message: "target must be driver|client" });
    }
    if (!content) return res.status(400).json({ message: "No content" });

    const type = target === "driver" ? "broadcast_driver" : "broadcast_client";

    const chat = await Chat.create({
      type,
      status: "active",
      title: title || null,
      adminId: adminId || senderId || null,
      // Автор (админ) не должен видеть своё как "непрочитано"
      adminLastReadAt: new Date(),
    });

    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId: senderId || adminId || null,
      senderRole: senderRole || "admin",
      content,
      contentType,
    });

    await chat.update({ updatedAt: new Date() });

    // 1) в комнату чата (если кто-то открыл этот чат)
    emitSocketMessage(req, chat.id, message);

    // 2) всем по аудитории (drivers/clients) + админам
    emitAudiencePush(req, chat, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};

// ======================================================
// NEW: SYSTEM (отдельный чат на каждого получателя)
// ======================================================

// @map: createSystemChat
export const createSystemChat = async (req, res) => {
  try {
    const {
      target, // "driver" | "client"
      driverId,
      clientId,
      title,
      content,
      adminId,
      senderId,
      senderRole,
      contentType = "text",
    } = req.body;

    if (!target || !["driver", "client"].includes(target)) {
      return res.status(400).json({ message: "target must be driver|client" });
    }
    if (!content) return res.status(400).json({ message: "No content" });

    if (target === "driver" && !driverId) {
      return res.status(400).json({ message: "driverId required" });
    }
    if (target === "client" && !clientId) {
      return res.status(400).json({ message: "clientId required" });
    }

    const type = target === "driver" ? "system_driver" : "system_client";

    const chat = await Chat.create({
      type,
      status: "active",
      title: title || "Система",
      driverId: target === "driver" ? driverId : null,
      clientId: target === "client" ? clientId : null,
      adminId: adminId || senderId || null,
      // Автор (админ/система) не должен видеть своё как "непрочитано"
      adminLastReadAt: new Date(),
    });

    const message = await ChatMessage.create({
      chatId: chat.id,
      senderId: senderId || adminId || null,
      senderRole: senderRole || "system",
      content,
      contentType,
    });

    await chat.update({ updatedAt: new Date() });

    // 1) в комнату чата (если кто-то открыл именно этот system чат)
    emitSocketMessage(req, chat.id, message);

    // 2) личная доставка (driver:<id> / client:<id>)
    emitAudiencePush(req, chat, message);

    return res.status(201).json({ chat, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error" });
  }
};
