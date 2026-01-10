import { Op, literal } from "sequelize";
import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import sequelize from "../../config/db.js"; // ДОБАВЛЕНО: импорт для транзакций

export const getAllChatsForDriver = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { page = 1, limit = 15 } = req.query;

    const numericLimit = parseInt(limit) || 15;
    const numericPage = parseInt(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    const whereCondition = { driverId };

    const total = await Chat.count({ where: whereCondition });

    const chats = await Chat.findAll({
      where: whereCondition,
      attributes: {
        include: [
          [
            literal(`(
              SELECT MAX(created_at)
              FROM chat_messages AS cm
              WHERE cm.chat_id = "Chat".id
              AND cm.sender_role != 'driver'
            )`),
            "lastOtherMessageAt",
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
          model: Order,
          as: "order",
          attributes: ["id", "status", "publicNumber"],
        },
      ],
    });

    const items = chats.map((chat) => {
      const chatJson = chat.toJSON();
      const lastOtherMsgAt = chatJson.lastOtherMessageAt
        ? new Date(chatJson.lastOtherMessageAt)
        : null;
      const driverReadAt = chatJson.driverLastReadAt
        ? new Date(chatJson.driverLastReadAt)
        : null;

      chatJson.hasUnread = lastOtherMsgAt
        ? !driverReadAt || lastOtherMsgAt > driverReadAt
        : false;
      return chatJson;
    });

    return res.status(200).json({
      success: true,
      items,
      pagination: {
        total,
        page: numericPage,
        limit: numericLimit,
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("ОШИБКА getAllChatsForDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: error.message,
    });
  }
};

export const createSupportChatByDriver = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const driverId = req.user.id;
    const { content, contentType = "text" } = req.body;

    if (!content || content.trim() === "") {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Сообщение не может быть пустым" });
    }

    let chat = await Chat.findOne({
      where: { driverId, type: "support_driver", status: "active" },
      transaction: t,
    });

    let isNewChat = false;

    if (!chat) {
      chat = await Chat.create(
        {
          type: "support_driver",
          driverId: driverId,
          status: "active",
          driverLastReadAt: new Date(),
        },
        { transaction: t }
      );
      isNewChat = true;
    } else {
      await chat.update({ driverLastReadAt: new Date() }, { transaction: t });
    }

    const newMessage = await ChatMessage.create(
      {
        chatId: chat.id,
        senderId: driverId,
        senderRole: "driver",
        contentType,
        content,
        isRead: false,
      },
      { transaction: t }
    );

    await t.commit();

    // ИЗМЕНЕНО: Уведомляем админов о новом обращении
    const io = req.app.get("io");
    if (io) {
      const nsp = io.of("/chat");
      if (isNewChat) {
        nsp.to("admins").emit("new_chat", { chat, firstMessage: newMessage });
      } else {
        nsp.to(String(chat.id)).emit("new_message", newMessage);
        nsp
          .to("admins")
          .emit("chat_updated", { chatId: chat.id, lastMessage: newMessage });
      }
    }

    return res.status(isNewChat ? 201 : 200).json({
      success: true,
      data: { chat, message: newMessage },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("ОШИБКА createSupportChatByDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: error.message,
    });
  }
};

export const sendMessageByDriver = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id: chatId } = req.params;
    const { content, contentType = "text" } = req.body;
    const driverId = req.user.id;

    const chat = await Chat.findOne({
      where: { id: chatId, driverId: driverId },
      transaction: t,
    });

    if (!chat) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Чат не найден" });
    }

    const newMessage = await ChatMessage.create(
      {
        chatId,
        senderId: driverId,
        senderRole: "driver",
        contentType,
        content,
        isRead: false,
      },
      { transaction: t }
    );

    await chat.update(
      { driverLastReadAt: new Date(), updatedAt: new Date() },
      { transaction: t }
    );

    await t.commit();

    // ИЗМЕНЕНО: Сокет-уведомления
    const io = req.app.get("io");
    if (io) {
      const nsp = io.of("/chat");
      // В саму комнату чата
      nsp.to(String(chatId)).emit("new_message", newMessage);
      // Админам для обновления списка и счетчиков
      nsp
        .to("admins")
        .emit("chat_updated", { chatId, lastMessage: newMessage });
    }

    return res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    if (t) await t.rollback();
    console.error("ОШИБКА sendMessageByDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при отправке",
      error: error.message,
    });
  }
};

export const getMessagesForDriver = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const driverId = req.user.id;

    const take = parseInt(limit) || 50;
    const skip = (parseInt(page) - 1) * take;

    const chat = await Chat.findOne({
      where: { id: chatId, driverId: driverId },
    });

    if (!chat) {
      return res.status(404).json({ success: false, message: "Чат не найден" });
    }

    chat.driverLastReadAt = new Date();
    await chat.save();

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
    console.error("ОШИБКА getMessagesForDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при загрузке",
      error: error.message,
    });
  }
};
