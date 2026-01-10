import { Router } from "express";

// ИЗМЕНЕНО: Импорт контроллеров Админа
import {
  getAllChatsForAdmin,
  getMessagesByChatId,
  sendMessage as sendMessageAdmin, // Используем алиас для ясности
  createBroadcastChat,
  createSystemChat,
} from "./chatAdmin.controllers.js";

// ИЗМЕНЕНО: Импорт контроллеров Водителя
import {
  getAllChatsForDriver,
  getMessagesForDriver,
  sendMessageByDriver,
  createSupportChatByDriver,
} from "./chatDriver.controllers.js";

// ИЗМЕНЕНО: Импорт обоих middleware для разных ролей
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authDriver } from "../../middlewares/authDriver.js";

const router = Router();

// ======================================================
// РОУТЫ ДЛЯ АДМИНИСТРАТОРА (SuperAdmin)
// ======================================================

// Получение списка всех чатов (фильтры по типу/статусу)
router.get("/admin/all", authMiddleware, getAllChatsForAdmin);

// Получение сообщений чата + обновление adminLastReadAt
router.get("/admin/:chatId/messages", authMiddleware, getMessagesByChatId);

// Отправка сообщения админом в чат
router.post("/admin/:chatId/messages", authMiddleware, sendMessageAdmin);

// Создание массовой рассылки (чат + первое сообщение)
router.post("/admin/broadcast", authMiddleware, createBroadcastChat);

// Создание системного уведомления (чат + первое сообщение)
router.post("/admin/system", authMiddleware, createSystemChat);

// ======================================================
// РОУТЫ ДЛЯ ВОДИТЕЛЯ (Mobile App)
// ======================================================

// Получение списка чатов конкретного водителя
router.get("/driver/all", authDriver, getAllChatsForDriver);

// Получение сообщений + обновление driverLastReadAt
router.get("/driver/:chatId/messages", authDriver, getMessagesForDriver);

// Отправка сообщения водителем
router.post("/driver/:chatId/messages", authDriver, sendMessageByDriver);

// Создание обращения в поддержку от водителя
router.post("/driver/support", authDriver, createSupportChatByDriver);

export default router;
