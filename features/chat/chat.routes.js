import { Router } from "express";
import {
  getOrCreateOrderChat,
  sendMessage,
  getChatMessages,
  getAllChats,
  getDriverChats,
} from "./chat.controller.js";

// 🎯 при необходимости подключим разные миддлвары
// import { authDriver } from "../middlewares/authDriver.js";
// import { authAdmin } from "../middlewares/authAdmin.js";

const router = Router();

/*
 * =============================
 *   ЧАТЫ ДЛЯ ЗАКАЗА (DRIVER/CLIENT)
 * =============================
 */

// Создать или вернуть существующий чат по заказу
// POST /api/chats/order
router.post("/order", getOrCreateOrderChat);

/*
 * =============================
 *   ЧАТЫ ВОДИТЕЛЯ (СПИСОК ДЛЯ МОБИЛКИ)
 * =============================
 */

// GET /api/chats/driver
// authDriver — позже подключим
router.get("/driver", /* authDriver, */ getDriverChats);

/*
 * =============================
 *   СООБЩЕНИЯ В ЧАТЕ
 * =============================
 */

// Получить историю сообщений
// GET /api/chats/:chatId/messages
router.get("/:chatId/messages", getChatMessages);

// Отправить сообщение
// POST /api/chats/:chatId/messages
router.post("/:chatId/messages", sendMessage);

/*
 * =============================
 *   СПИСОК ВСЕХ ЧАТОВ (АДМИН / ДИСПЕТЧЕР)
 * =============================
 */

// GET /api/chats
router.get("/", /* authAdmin, */ getAllChats);

export default router;
