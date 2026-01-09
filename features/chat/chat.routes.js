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
import { authDriver } from "../middlwares/authDriver.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

// ORDER
router.post("/order-chat", getOrCreateOrderChat);

// MESSAGES
router.post("/:chatId/messages", sendMessage);

router.get("/driver/:chatId/messages", authDriver, getChatMessages);

router.get("/admin/:chatId/messages", authMiddleware, getChatMessages);

// LISTS
router.get("/", getAllChats);
router.get("/driver", authDriver, getDriverChats);

// SUPPORT
router.post("/support/driver", createSupportChatWithDriver);

// NEW: BROADCAST + SYSTEM
router.post("/broadcast", createBroadcastChat);
router.post("/system", createSystemChat);

export default router;
