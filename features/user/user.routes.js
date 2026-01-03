// routes/user.routes.js
import { Router } from "express";
import {
  createSuperAdmin,
  createUser,
  login,
  getMe,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserPasswordBySuperAdmin,
} from "./user.controllers.js";
import {
  authMiddleware,
  requireRoles,
} from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * 1) Создать супер-админа (вызываешь один раз через Postman)
 *    POST /api/users/create-superadmin
 *    body: { phone, password, name? }
 */
router.post("/create-superadmin", createSuperAdmin);

/**
 * 2) Логин (superadmin, admin, park, dispatcher)
 *    POST /api/users/login
 *    body: { phone, password }
 */
router.post("/login", login);

/**
 * 3) Получить текущего пользователя
 *    GET /api/users/me
 *    header: Authorization: Bearer <token>
 */
router.get("/me", authMiddleware, getMe);

/**
 * 4) Создание admin / park / dispatcher
 *    POST /api/users/create
 *    header: Authorization: Bearer <token> (superadmin или admin)
 *    body: { phone, password, name?, role: "admin" | "park" | "dispatcher" }
 */
router.post(
  "/create",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  createUser
);

/**
 * 5) Список пользователей
 *    GET /api/users?role=&isActive=&page=&limit=
 *    header: Authorization: Bearer <token> (superadmin или admin)
 *    superadmin → видит всех (по фильтру role)
 *    admin      → только dispatcher
 */
router.get(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  listUsers
);

/**
 * 6) Получить пользователя по id
 *    GET /api/users/:id
 *    header: Authorization: Bearer <token> (superadmin или admin)
 */
router.get(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  getUserById
);

/**
 * 7) Обновить пользователя (без смены пароля)
 *    PUT /api/users/:id
 *    header: Authorization: Bearer <token> (superadmin или admin)
 *    superadmin может менять роль, admin — нет (проверка в контроллере)
 */
router.put(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  updateUser
);

/**
 * 8) Удалить пользователя (soft-delete: isActive = false)
 *    DELETE /api/users/:id
 *    header: Authorization: Bearer <token> (superadmin или admin)
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  deleteUser
);

/**
 * 9) Обновление пароля ЛЮБОГО пользователя
 *    только SUPERADMIN
 *    POST /api/users/:id/change-password
 *    header: Authorization: Bearer <token> (superadmin)
 *    body: { newPassword }
 */
router.post(
  "/:id/change-password",
  authMiddleware,
  requireRoles(["superadmin"]),
  updateUserPasswordBySuperAdmin
);

export default router;
