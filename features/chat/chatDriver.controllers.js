import { Op, literal } from "sequelize"; // Используем прямой импорт literal
import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";

/**
 * Получение всех чатов водителя (аналог админского контроллера)
 */
export const getAllChatsForDriver = async (req, res) => {
  try {
    // ID водителя из middleware authDriver
    const driverId = req.user.id;
    const { page = 1, limit = 15 } = req.query;

    const numericLimit = parseInt(limit) || 15;
    const numericPage = parseInt(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    // Условие: только чаты, где этот пользователь — водитель
    const whereCondition = { driverId };

    // 1. Считаем общее количество чатов водителя
    const total = await Chat.count({ where: whereCondition });

    // 2. Запрос к БД
    const chats = await Chat.findAll({
      where: whereCondition,
      attributes: {
        include: [
          // Подзапрос для даты последнего сообщения от КОГО-ТО ДРУГОГО (не водителя)
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
      order: [["updatedAt", "DESC"]], // Самые свежие чаты сверху
      include: [
        {
          model: ChatMessage,
          as: "messages",
          separate: true,
          limit: 1, // Последнее сообщение для превью
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

    // 3. Маппинг данных и вычисление статуса hasUnread
    const items = chats.map((chat) => {
      const chatJson = chat.toJSON();

      const lastOtherMsgAt = chatJson.lastOtherMessageAt
        ? new Date(chatJson.lastOtherMessageAt)
        : null;
      const driverReadAt = chatJson.driverLastReadAt
        ? new Date(chatJson.driverLastReadAt)
        : null;

      // Если кто-то (админ/клиент) писал позже, чем водитель открывал чат
      chatJson.hasUnread = lastOtherMsgAt
        ? !driverReadAt || lastOtherMsgAt > driverReadAt
        : false;

      return chatJson;
    });

    // 4. Ответ
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
      message: "Ошибка сервера при получении списка чатов водителя",
      error: error.message,
    });
  }
};

export const createSupportChatByDriver = async (req, res) => {
  // ДОБАВЛЕНО: Запуск транзакции для атомарности создания чата и сообщения
  const t = await sequelize.transaction();

  try {
    // ДОБАВЛЕНО: Получаем driverId из middleware authDriver
    const driverId = req.user.id;
    const { content, contentType = "text" } = req.body;

    // ДОБАВЛЕНО: Валидация входных данных
    if (!content || content.trim() === "") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Первое сообщение не может быть пустым",
      });
    }

    // ИЗМЕНЕНО: Проверяем, нет ли уже активного чата поддержки для этого водителя
    // Это предотвращает создание нескольких веток поддержки для одного юзера
    let chat = await Chat.findOne({
      where: {
        driverId,
        type: "support_driver",
        status: "active",
      },
      transaction: t,
    });

    let isNewChat = false;

    if (!chat) {
      // 1. Создаем новый чат, если активного еще нет
      chat = await Chat.create(
        {
          type: "support_driver",
          driverId: driverId,
          status: "active",
          // ДОБАВЛЕНО: Сразу помечаем время прочтения для водителя
          driverLastReadAt: new Date(),
        },
        { transaction: t }
      );
      isNewChat = true;
    } else {
      // ДОБАВЛЕНО: Если чат уже был, обновляем время прочтения водителем
      await chat.update({ driverLastReadAt: new Date() }, { transaction: t });
    }

    // 2. Создаем первое сообщение от лица водителя
    const newMessage = await ChatMessage.create(
      {
        chatId: chat.id,
        senderId: driverId,
        senderRole: "driver",
        contentType: contentType,
        content: content,
        isRead: false, // Для админа это сообщение будет новым
      },
      { transaction: t }
    );

    // Фиксируем изменения
    await t.commit();

    return res.status(isNewChat ? 201 : 200).json({
      success: true,
      message: isNewChat
        ? "Чат поддержки создан"
        : "Сообщение добавлено в существующий чат",
      data: {
        chat,
        message: newMessage,
      },
    });
  } catch (error) {
    // ДОБАВЛЕНО: Откат транзакции при ошибке
    if (t) await t.rollback();
    console.error("ОШИБКА createSupportChatByDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при создании обращения в поддержку",
      error: error.message,
    });
  }
};

export const sendMessageByDriver = async (req, res) => {
  // Начинаем транзакцию для атомарности
  const t = await sequelize.transaction();

  try {
    const { id: chatId } = req.params; // ID чата из URL
    const { content, contentType = "text" } = req.body;

    // Берем ID водителя из middleware authDriver
    const driverId = req.user.id;

    // 1. Проверяем существование чата И принадлежность его этому водителю
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        driverId: driverId, // Защита: водитель пишет только в свой чат
      },
      transaction: t,
    });

    if (!chat) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Чат не найден или у вас нет доступа к нему",
      });
    }

    // 2. Создаем сообщение
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

    // 3. ИЗМЕНЕНО: Обновляем только driver_last_read_at и updated_at
    await chat.update(
      {
        driverLastReadAt: new Date(), // Водитель прочитал чат, так как сам отправил сообщение
        updatedAt: new Date(), // Поднимаем чат в списке
      },
      { transaction: t }
    );

    // Фиксируем изменения
    await t.commit();

    // Возвращаем созданное сообщение (фронтенд добавит его в стейт)
    return res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("ОШИБКА sendMessageByDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при отправке сообщения водителем",
      error: error.message,
    });
  }
};

export const getMessagesForDriver = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // ДОБАВЛЕНО: Получаем ID водителя из middleware authDriver
    const driverId = req.user.id;

    const take = parseInt(limit) || 50;
    const skip = (parseInt(page) - 1) * take;

    // 1. ИЗМЕНЕНО: Ищем чат с жесткой проверкой владельца (driverId)
    // Это гарантирует, что водитель не прочитает сообщения чужого заказа
    const chat = await Chat.findOne({
      where: {
        id: chatId,
        driverId: driverId,
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Чат не найден или доступ ограничен",
      });
    }

    // 2. ИЗМЕНЕНО: Фиксируем время прочтения именно ВОДИТЕЛЕМ
    // При каждом получении списка сообщений обновляем метку времени
    chat.driverLastReadAt = new Date();
    await chat.save();

    // 3. Получение сообщений с пагинацией
    const { count, rows: messages } = await ChatMessage.findAndCountAll({
      where: { chatId },
      limit: take,
      offset: skip,
      // Сортировка ASC (от старых к новым), чтобы чат шел сверху вниз
      order: [["createdAt", "ASC"]],
    });

    // 4. Возврат данных в унифицированном формате
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
    // ДОБАВЛЕНО: Логирование для отладки на сервере
    console.error("ОШИБКА getMessagesForDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при загрузке сообщений чата",
      error: error.message,
    });
  }
};
