// routes/photoControl.routes.js

import { Router } from "express";
import {
  getPhotoControls,
  getPhotoControlById,
  updatePhotoControlStatus,
  checkPhotoControlForDriverAndVehicle,
  createPhotoControl,
} from "./photoControl.controller.js";
// при необходимости можно подключить миддлвары авторизации
// import { authDriver } from "../middlwares/authDriver.js";
// import { authAdmin } from "../middlwares/authAdmin.js";

const router = Router();

/**
 * Базовый префикс предполагается: /api/photo-controls
 *
 * Примеры:
 * GET    /api/photo-controls
 * GET    /api/photo-controls?driverId=...&vehicleId=...&status=pending&page=1&limit=20
 * GET    /api/photo-controls/check?driverId=...&vehicleId=...
 * GET    /api/photo-controls/:id
 * PATCH  /api/photo-controls/:id/status
 */

// 1. Получить список фотоконтролей с фильтрами
// GET /api/photo-controls
router.get("/", getPhotoControls);

// 2. Проверить, пройден ли фотоконтроль за последние 15 дней
// GET /api/photo-controls/check?driverId=...&vehicleId=...
router.get("/check", checkPhotoControlForDriverAndVehicle);

// 3. Получить один фотоконтроль по ID
// GET /api/photo-controls/:id
router.get("/:id", getPhotoControlById);

// 4. Обновить статус фотоконтроля
// PATCH /api/photo-controls/:id/status
router.patch("/:id/status", updatePhotoControlStatus);

export default router;
