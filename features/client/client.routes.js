import { Router } from "express";
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
} from "./client.controller.js";
import {
  authMiddleware,
  requireRoles,
} from "../../middlewares/auth.middleware.js";

const router = Router();

// Все маршруты защищены и доступны Admin, SuperAdmin и Dispatcher

/**
 * 1. Создать клиента вручную
 * POST /api/clients
 */
router.post(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin", "dispatcher"]),
  createClient
);

/**
 * 2. Список клиентов (поиск, фильтры)
 * GET /api/clients?q=996555&isActive=true
 */
router.get(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin", "dispatcher"]),
  listClients
);

/**
 * 3. Получить одного клиента
 * GET /api/clients/:id
 */
router.get(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin", "dispatcher"]),
  getClientById
);

/**
 * 4. Обновить клиента (изменить имя, телефон, заблокировать)
 * PUT /api/clients/:id
 */
router.put(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]), // Диспетчеру лучше не давать менять важные данные, но решай сам. Тут оставил Admins.
  updateClient
);

/**
 * 5. Удалить (деактивировать)
 * DELETE /api/clients/:id
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  deleteClient
);

export default router;
