import { Router } from "express";
import {
  getAllChatsForAdmin, // ИЗМЕНЕНО: Получение всех чатов с фильтрами
  getMessagesByChatId, // ИЗМЕНЕНО: Получение сообщений + обновление adminLastReadAt
  sendMessage, // ИЗМЕНЕНО: Отправка только в support_* чаты
  createBroadcastChat, // ИЗМЕНЕНО: Атомарное создание (чат + сообщение)
  createSystemChat, // ИЗМЕНЕНО: Атомарное создание (чат + сообщение)
} from "./chatAdmin.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/all", getAllChatsForAdmin);
router.get("/:chatId/messages", getMessagesByChatId);
router.post("/:chatId/messages", sendMessage);
router.post("/broadcast", createBroadcastChat);
router.post("/system", createSystemChat);

export default router;
