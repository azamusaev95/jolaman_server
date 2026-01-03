import { Router } from "express";
import {
  createTariff,
  listTariffs,
  getTariffById,
  updateTariff,
  deleteTariff,
} from "./tariff.controller.js";
import {
  authMiddleware,
  requireRoles,
} from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * 1) Создать новый тариф
 * POST /api/tariffs
 * header: Authorization: Bearer <token> (superadmin, admin)
 * body: {
 * name: "econom" | "courier_foot" ...,
 * category: "taxi" | "delivery" | "cargo",
 * basePrice, pricePerKm, pricePerMinute, waitingPrice
 * }
 */
router.post(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  createTariff
);

/**
 * 2) Список тарифов (с фильтрами и пагинацией)
 * GET /api/tariffs?category=delivery&isActive=true&page=1&limit=20
 * header: Authorization: Bearer <token> (superadmin, admin)
 */
router.get(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  listTariffs
);

/**
 * 3) Получить тариф по ID
 * GET /api/tariffs/:id
 * header: Authorization: Bearer <token> (superadmin, admin)
 */
router.get(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  getTariffById
);

/**
 * 4) Обновить тариф
 * PUT /api/tariffs/:id
 * header: Authorization: Bearer <token> (superadmin, admin)
 * body: { basePrice, pricePerKm, ... }
 */
router.put(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  updateTariff
);

/**
 * 5) Удалить тариф (деактивация)
 * DELETE /api/tariffs/:id
 * header: Authorization: Bearer <token> (superadmin, admin)
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  deleteTariff
);

export default router;
