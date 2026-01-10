import Chat from "./chat.model.js";
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";
import { Op } from "sequelize";

export const getAllChatsForAdmin = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 15 } = req.query;

    const numericLimit = parseInt(limit) || 15;
    const numericPage = parseInt(page) || 1;
    const offset = (numericPage - 1) * numericLimit;

    const whereCondition = {};
    if (type) whereCondition.type = type;
    if (status) whereCondition.status = status;

    // 1. Получаем общее количество записей
    const total = await Chat.count({ where: whereCondition });

    // 2. Основной запрос к БД
    const chats = await Chat.findAll({
      where: whereCondition,
      attributes: {
        include: [
          // ДОБАВЛЕНО: Подзапрос для получения даты последнего сообщения НЕ от админа
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
          // УДАЛЕНО: Фильтр по роли (теперь берем абсолютно последнее сообщение)
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

    // 3. Формируем чистый массив объектов (items)
    const items = chats.map((chat) => {
      const chatJson = chat.toJSON();

      // ДОБАВЛЕНО: Логика определения "непрочитанности" для админа
      const lastUserMsgAt = chatJson.lastNonAdminMessageAt
        ? new Date(chatJson.lastNonAdminMessageAt)
        : null;
      const adminReadAt = chatJson.adminLastReadAt
        ? new Date(chatJson.adminLastReadAt)
        : null;

      // Если есть сообщение от юзера, и оно новее, чем админ читал, или админ вообще не читал
      chatJson.hasUnread = lastUserMsgAt
        ? !adminReadAt || lastUserMsgAt > adminReadAt
        : false;

      // Удаляем техническое поле подзапроса из выдачи, если оно не нужно фронту
      // delete chatJson.lastNonAdminMessageAt;

      return chatJson;
    });

    // 4. Возврат данных в запрошенном формате
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
    const { page = 1, limit = 50 } = req.query; // ДОБАВЛЕНО: пагинация для сообщений

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    // 1. Ищем чат, чтобы проверить его тип
    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Чат не найден",
      });
    }

    // 2. ИЗМЕНЕНО: логика обновления adminLastReadAt
    // Обновляем только если это чаты поддержки
    const supportTypes = ["support_client", "support_driver"];

    if (supportTypes.includes(chat.type)) {
      // ИЗМЕНЕНО: фиксируем время прочтения админом
      chat.adminLastReadAt = new Date();
      await chat.save();

      console.log(
        `✅ Статус прочтения обновлен для чата: ${chatId} (Тип: ${chat.type})`
      );
    }

    // 3. ДОБАВЛЕНО: получение сообщений с пагинацией
    const { count, rows: messages } = await ChatMessage.findAndCountAll({
      where: { chatId },
      limit: take,
      offset: skip,
      // ИЗМЕНЕНО: сортировка от старых к новым (хронология чата)
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
    // ДОБАВЛЕНО: детальный лог ошибки
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

    // 1. Ищем чат для проверки условий
    const chat = await Chat.findByPk(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Чат не найден",
      });
    }

    // 2. ИЗМЕНЕНО: Ограничение типов чата для отправки сообщений
    const allowedTypes = ["support_client", "support_driver"];

    // ДОБАВЛЕНО: Если тип чата не входит в список разрешенных, запрещаем отправку
    if (!allowedTypes.includes(chat.type)) {
      return res.status(403).json({
        success: false,
        message: `Отправка сообщений запрещена. Данный метод работает только для типов: ${allowedTypes.join(
          ", "
        )}`,
      });
    }

    // 3. ДОБАВЛЕНО: Создание сообщения в базе данных
    const newMessage = await ChatMessage.create({
      chatId,
      senderId,
      senderRole,
      contentType: contentType || "text",
      content,
      isRead: false,
    });

    // 4. ИЗМЕНЕНО: Обновление мета-данных чата (кто прочитал и когда обновлен)
    const now = new Date();

    // Обновляем поле "последний раз открывал" для того, кто сейчас отправил сообщение
    if (senderRole === "admin") {
      chat.adminLastReadAt = now;
    } else if (senderRole === "driver") {
      chat.driverLastReadAt = now;
    } else if (senderRole === "client") {
      chat.clientLastReadAt = now;
    }

    // ДОБАВЛЕНО: Принудительное обновление updatedAt, чтобы чат поднялся в списке всех чатов
    chat.changed("updatedAt", true);
    await chat.save();

    return res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    // ДОБАВЛЕНО: Логирование для Senior Developer
    console.error("CRITICAL ERROR: sendMessage failed ->", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при отправке сообщения",
      error: error.message,
    });
  }
};

export const createBroadcastChat = async (req, res) => {
  // ДОБАВЛЕНО: Запуск транзакции для обеспечения атомарности
  const t = await sequelize.transaction();

  try {
    // ИЗМЕНЕНО: Теперь ожидаем content и optional contentType в теле запроса
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

    // ДОБАВЛЕНО: Проверка наличия контента сообщения
    if (!title || !content) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Для рассылки обязательны заголовок (title) и текст сообщения (content)",
      });
    }

    // 1. Создаем чат
    const chat = await Chat.create(
      {
        type,
        title,
        adminId,
        status: "active",
      },
      { transaction: t }
    );

    // 2. ДОБАВЛЕНО: Сразу создаем первое и единственное сообщение
    await ChatMessage.create(
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

    // Фиксируем изменения в базе
    await t.commit();

    return res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    // ДОБАВЛЕНО: Откат транзакции при любой ошибке
    await t.rollback();
    console.error("ОШИБКА createBroadcastChat:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при создании чата рассылки",
      error: error.message,
    });
  }
};

/**
 * Создание системного чата (System Notification) с первым сообщением
 */
export const createSystemChat = async (req, res) => {
  // ДОБАВЛЕНО: Запуск транзакции
  const t = await sequelize.transaction();

  try {
    // ИЗМЕНЕНО: Добавлены поля content и contentType
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

    // ДОБАВЛЕНО: Валидация контента
    if (!content) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Не указан текст системного уведомления (content)",
      });
    }

    if (type === "system_driver" && !driverId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Не указан driverId для system_driver",
      });
    }
    if (type === "system_client" && !clientId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Не указан clientId для system_client",
      });
    }

    // 1. Создаем системный чат
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

    // 2. ДОБАВЛЕНО: Создаем системное сообщение
    await ChatMessage.create(
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

    // Фиксируем изменения
    await t.commit();

    return res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    // ДОБАВЛЕНО: Откат транзакции
    await t.rollback();
    console.error("ОШИБКА createSystemChat:", error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при создании системного чата",
      error: error.message,
    });
  }
};
