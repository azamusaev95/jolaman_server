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

// Импортируем именно твои валидаторы
import {
  createSuperAdminValidator,
  createUserValidator,
  loginValidator,
  updatePasswordValidator,
} from "../validators/user.validator.js";

const router = Router();

/**
 * 1) Создать супер-админа
 */
router.post("/create-superadmin", createSuperAdminValidator, createSuperAdmin);

/**
 * 2) Логин
 */
router.post("/login", loginValidator, login);

/**
 * 3) Получить текущего пользователя
 */
router.get("/me", authMiddleware, getMe);

/**
 * 4) Создание admin / dispatcher
 */
router.post(
  "/create",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  createUserValidator, // Твой валидатор
  createUser
);

/**
 * 5) Список пользователей
 */
router.get(
  "/",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  listUsers
);

/**
 * 6) Получить пользователя по id
 */
router.get(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  getUserById
);

/**
 * 7) Обновить пользователя (без смены пароля)
 */
router.put(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  updateUser
);

/**
 * 8) Удалить пользователя
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(["superadmin", "admin"]),
  deleteUser
);

/**
 * 9) Обновление пароля (только SUPERADMIN)
 */
router.post(
  "/:id/change-password",
  authMiddleware,
  requireRoles(["superadmin"]),
  updatePasswordValidator, // Твой валидатор для смены пароля
  updateUserPasswordBySuperAdmin
);

export default router;
