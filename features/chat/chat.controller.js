import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";

// @map: getOrCreateOrderChat (Создать/Найти Чат) -> orderId, clientId, driverId, type, status [Public/Auth]
export const getOrCreateOrderChat = async (req, res) => {
  try {
    const { orderId, clientId, driverId } = req.body;

    // Ищем существующий чат
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
      // Создаем новый
      const newChat = await Chat.create({
        type: "order",
        orderId,
        clientId,
        driverId,
        status: "active",
      });

      // Перезагружаем с данными
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

    const message = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      content,
      contentType,
    });

    // Обновляем updatedAt у чата, чтобы он поднялся в списке
    await Chat.update({ updatedAt: new Date() }, { where: { id: chatId } });

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
    const offset = (page - 1) * limit;

    const messages = await ChatMessage.findAndCountAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: Number(limit),
      offset: Number(offset),
    });

    return res.json({
      items: messages.rows,
      total: messages.count,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка загрузки сообщений" });
  }
};

// @map: getAllChats (Все Чаты) -> orderId, clientId, driverId, status [Admin/Dispatcher]
export const getAllChats = async (req, res) => {
  try {
    const { orderId } = req.query;
    const where = {};
    if (orderId) where.orderId = orderId;

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
