import { Router } from "express";
import {
  checkAllControls,
  createPhotoControl,
  getPhotoControls,
  getPhotoControlById,
  updatePhotoControlStatus,
  createSelfieControl,
  getSelfieControls,
  updateSelfieStatus,
} from "./photoControl.controller.js";
const router = Router();

/**
 * Базовый префикс в app.js рекомендуется изменить на: /api/controls
 * * ЕДИНАЯ ПРОВЕРКА (Фото + Селфи)
 * GET /api/controls/check?driverId=...&vehicleId=...
 */
// ИЗМЕНЕНО: Добавлен единый роут для проверки всех типов контроля
router.get("/check", checkAllControls);

// --- СЕКЦИЯ ФОТОКОНТРОЛЯ АВТО ---

// ИЗМЕНЕНО: Добавлен POST для создания записи фотоконтроля
// POST /api/controls/photo
router.post("/photo", createPhotoControl);

// GET /api/controls/photo
router.get("/photo", getPhotoControls);

// GET /api/controls/photo/:id
router.get("/photo/:id", getPhotoControlById);

// PATCH /api/controls/photo/:id/status
router.patch("/photo/:id/status", updatePhotoControlStatus);

// --- СЕКЦИЯ СЕЛФИ-КОНТРОЛЯ ---

// ИЗМЕНЕНО: Добавлены роуты для работы с селфи-контролем
// POST /api/controls/selfie
router.post("/selfie", createSelfieControl);

// GET /api/controls/selfie
router.get("/selfie", getSelfieControls);

// PATCH /api/controls/selfie/:id/status
router.patch("/selfie/:id/status", updateSelfieStatus);

// УДАЛЕНО: Старый роут /check для одного только фотоконтроля удален в пользу общего /check

export default router;
