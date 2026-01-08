import { Router } from "express";

import {
  getOrCreateOrderChat,
  sendMessage,
  getChatMessages,
  getAllChats,
  getDriverChats,
  createSupportChatWithDriver,
  createBroadcastChat,
  createSystemChat,
} from "./chat.controller.js";

const router = Router();

// ORDER
router.post("/order-chat", getOrCreateOrderChat);

// MESSAGES
router.post("/:chatId/messages", sendMessage);
router.get("/:chatId/messages", getChatMessages);

// LISTS
router.get("/", getAllChats);
router.get("/driver", getDriverChats);

// SUPPORT
router.post("/support/driver", createSupportChatWithDriver);

// NEW: BROADCAST + SYSTEM
router.post("/broadcast", createBroadcastChat);
router.post("/system", createSystemChat);

export default router;
