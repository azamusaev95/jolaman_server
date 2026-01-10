import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import Sequelize, { Op } from "sequelize";
import sequelize from "../../config/db.js"; // ДОБАВЛЕНО: импорт sequelize для транзакций

export const getAllChatsForAdmin = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 15 } = req.query;

    const numericLimit = parseInt(limit) || 15;
    const numericPage = parseInt(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    const whereCondition = {};
    if (type) whereCondition.type = type;
    if (status) whereCondition.status = status;

    const total = await Chat.count({ where: whereCondition });

    const chats = await Chat.findAll({
      where: whereCondition,
      attributes: {
        include: [
          [
            Sequelize.literal(`(
              SELECT MAX(created_at)
              FROM chat_messages AS cm
              WHERE cm.chat_id = "Chat".id
              AND cm.sender_role != 'admin'
            )`),
            "lastNonAdminMessageAt",
          ],
        ],
      },
      limit: numericLimit,
      offset: offset,
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: ChatMessage,
          as: "messages",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
        {
          model: Client,
          as: "client",
          attributes: ["id", "name", "phone"],
        },
        {
          model: Driver,
          as: "driver",
          attributes: ["id", "firstName", "lastName", "phone"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "status", "publicNumber"],
        },
      ],
    });

    const items = chats.map((chat) => {
      const chatJson = chat.toJSON();

      const lastUserMsgAt = chatJson.lastNonAdminMessageAt
        ? new Date(chatJson.lastNonAdminMessageAt)
        : null;
      const adminReadAt = chatJson.adminLastReadAt
        ? new Date(chatJson.adminLastReadAt)
        : null;

      chatJson.hasUnread = lastUserMsgAt
        ? !adminReadAt || lastUserMsgAt > adminReadAt
        : false;

      return chatJson;
    });

    return res.status(200).json({
      items,
      pagination: {
        total,
        page: numericPage,
        limit: numericLimit,
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("ОШИБКА getAllChatsForAdmin:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка сервера при получении списка чатов",
      error: error.message,
    });
  }
};

export const getMessagesByChatId = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Чат не найден",
      });
    }

    const supportTypes = ["support_client", "support_driver"];

    if (supportTypes.includes(chat.type)) {
      chat.adminLastReadAt = new Date();
      await chat.save();
    }

    const { count, rows: messages } = await ChatMessage.findAndCountAll({
      where: { chatId },
      limit: take,
      offset: skip,
      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: messages,
      meta: {
        totalItems: count,
        totalPages: Math.ceil(count / take),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error("ОШИБКА getMessagesByChatId:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при загрузке сообщений",
      error: error.message,
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, senderRole, contentType, content } = req.body;

    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Чат не найден",
      });
    }

    const allowedTypes = ["support_client", "support_driver"];

    if (!allowedTypes.includes(chat.type)) {
      return res.status(403).json({
        success: false,
        message: `Отправка сообщений запрещена. Данный метод работает только для типов: ${allowedTypes.join(
          ", "
        )}`,
      });
    }

    const newMessage = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      contentType: contentType || "text",
      content,
      isRead: false,
    });

    const now = new Date();

    if (senderRole === "admin") {
      chat.adminLastReadAt = now;
    }

    chat.changed("updatedAt", true);
    await chat.save();

    // ИЗМЕНЕНО: Интеграция Socket.io
    const io = req.app.get("io");
    if (io) {
      const chatNamespace = io.of("/chat");

      // 1. Отправляем сообщение всем в комнате chatId
      chatNamespace.to(String(chatId)).emit("new_message", newMessage);

      // 2. Уведомляем конкретного получателя для обновления списка чатов
      if (chat.driverId) {
        chatNamespace
          .to(`driver:${chat.driverId}`)
          .emit("chat_updated", { chatId, lastMessage: newMessage });
      } else if (chat.clientId) {
        chatNamespace
          .to(`client:${chat.clientId}`)
          .emit("chat_updated", { chatId, lastMessage: newMessage });
      }
    }

    return res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    console.error("CRITICAL ERROR: sendMessage failed ->", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при отправке сообщения",
      error: error.message,
    });
  }
};

export const createBroadcastChat = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { type, title, adminId, content, contentType = "text" } = req.body;

    const allowedTypes = ["broadcast_driver", "broadcast_client"];
    if (!allowedTypes.includes(type)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Неверный тип чата для рассылки. Допустимы: broadcast_driver, broadcast_client",
      });
    }

    if (!title || !content) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Для рассылки обязательны заголовок (title) и текст сообщения (content)",
      });
    }

    const chat = await Chat.create(
      { type, title, adminId, status: "active" },
      { transaction: t }
    );

    const firstMsg = await ChatMessage.create(
      {
        chatId: chat.id,
        senderId: adminId,
        senderRole: "admin",
        contentType: contentType,
        content: content,
        isRead: false,
      },
      { transaction: t }
    );

    await t.commit();

    // ИЗМЕНЕНО: Уведомление через сокеты о новой рассылке
    const io = req.app.get("io");
    if (io) {
      const targetRoom = type === "broadcast_driver" ? "drivers" : "clients";
      io.of("/chat")
        .to(targetRoom)
        .emit("new_chat", { chat, firstMessage: firstMsg });
    }

    return res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    await t.rollback();
    console.error("ОШИБКА createBroadcastChat:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при создании чата рассылки",
      error: error.message,
    });
  }
};

export const createSystemChat = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      type,
      title,
      adminId,
      driverId,
      clientId,
      content,
      contentType = "text",
    } = req.body;

    const allowedTypes = ["system_driver", "system_client"];
    if (!allowedTypes.includes(type)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Неверный тип системного чата. Допустимы: system_driver, system_client",
      });
    }

    if (!content) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Не указан текст системного уведомления (content)",
      });
    }

    if (type === "system_driver" && !driverId) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Не указан driverId" });
    }
    if (type === "system_client" && !clientId) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Не указан clientId" });
    }

    const chat = await Chat.create(
      {
        type,
        title,
        adminId,
        driverId: type === "system_driver" ? driverId : null,
        clientId: type === "system_client" ? clientId : null,
        status: "active",
      },
      { transaction: t }
    );

    const firstMsg = await ChatMessage.create(
      {
        chatId: chat.id,
        senderId: adminId,
        senderRole: "admin",
        contentType: contentType,
        content: content,
        isRead: false,
      },
      { transaction: t }
    );

    await t.commit();

    // ИЗМЕНЕНО: Персональное уведомление пользователю
    const io = req.app.get("io");
    if (io) {
      const targetRoom =
        type === "system_driver" ? `driver:${driverId}` : `client:${clientId}`;
      io.of("/chat")
        .to(targetRoom)
        .emit("new_chat", { chat, firstMessage: firstMsg });
    }

    return res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    await t.rollback();
    console.error("ОШИБКА createSystemChat:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при создании системного чата",
      error: error.message,
    });
  }
};
