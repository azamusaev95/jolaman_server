import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../features/user/user.model.js"; // путь под текущую структуру

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_change_me";

/**
 * Базовая авторизация:
 * - ждём заголовок Authorization: Bearer <token>
 * - проверяем токен
 * - достаём юзера из БД
 * - кладём в req.user (id, phone, name, role, isActive)
 *
 * Если что-то не так — 401 / 403.
 */
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const tokenValue = authHeader.split(" ")[1]; // "Bearer <token>"
    const decoded = jwt.verify(tokenValue, JWT_SECRET);

    // В токене мы кладём { id, role } в login
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findByPk(userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or not active" });
    }

    // Кладём в req.user то, на что опираются контроллеры
    req.user = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    console.error("❌ Token verification error:", error);
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

/**
 * Ограничение по ролям:
 * - Использует req.user.role, установленный в authMiddleware
 * - Если роль не подходит — 403
 */
export function requireRoles(roles = []) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (roles.length && !roles.includes(user.role)) {
        return res
          .status(403)
          .json({ message: "Forbidden: insufficient permissions" });
      }

      return next();
    } catch (error) {
      console.error("❌ Role check error:", error);
      return res.status(500).json({ message: "Role check error" });
    }
  };
}

/**
 * Опциональная авторизация (бывший checkOwnership):
 * - НЕ кидает 401/403
 * - если токен валидный → req.user, req.isOwner = true
 * - если токена нет или он невалидный → req.user = null, req.isOwner = false
 *
 * Можно использовать на публичных ручках, где
 * иногда нужно знать, кто зашёл, но не обязательно.
 */
export const checkOwnership = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // По умолчанию считаем, что пользователь не "владелец"
  req.user = null;
  req.isOwner = false;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const tokenValue = authHeader.split(" ")[1]; // "Bearer <token>"
    const decoded = jwt.verify(tokenValue, JWT_SECRET);

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return next();
    }

    const user = await User.findByPk(userId);
    if (!user || !user.isActive) {
      return next();
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
    req.isOwner = true;

    next();
  } catch (error) {
    console.error("❌ Token verification error (checkOwnership):", error);
    // токен битый — просто считаем, что не владелец
    req.user = null;
    req.isOwner = false;
    next();
  }
};
