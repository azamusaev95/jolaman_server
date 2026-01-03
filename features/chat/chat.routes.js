import { Router } from "express";
import {
  getOrCreateOrderChat,
  sendMessage,
  getChatMessages,
  getAllChats,
} from "./chat.controller.js";

// Если есть middleware авторизации, добавь их сюда
// import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

// Создать/Найти чат для заказа
router.post("/order-chat", getOrCreateOrderChat);

// Отправить сообщение в чат :id
router.post("/:chatId/messages", sendMessage);

// Получить сообщения чата :id
router.get("/:chatId/messages", getChatMessages);

// Получить список чатов (для админки)
router.get("/", getAllChats);

export default router;
