import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "./user.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_change_me";
const JWT_EXPIRES_IN = "7d";

const canManageUser = (currentUser, targetUser) => {
  if (!currentUser || !targetUser) return false;
  if (currentUser.role === "superadmin") return true;
  if (currentUser.role === "admin") return targetUser.role === "dispatcher";
  return false;
};

// @map: createSuperAdmin (Создание Супер-Админа) -> phone, passwordHash, role, name, isActive [Public]
export const createSuperAdmin = async (req, res) => {
  try {
    const { phone, password, name } = req.body;
    const existingSuper = await User.findOne({ where: { role: "superadmin" } });
    if (existingSuper)
      return res.status(403).json({ error: "Superadmin уже существует." });

    const existingByPhone = await User.findOne({ where: { phone } });
    if (existingByPhone)
      return res.status(400).json({ error: "Телефон занят" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      phone,
      passwordHash,
      role: "superadmin",
      name: name || "Super Admin",
      isActive: true,
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return res.json({
      success: true,
      user: { id: user.id, phone: user.phone, role: user.role },
      token,
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: createUser (Создание Пользователя) -> phone, passwordHash, role, name, isActive [Admin, Superadmin]
export const createUser = async (req, res) => {
  try {
    const { phone, password, name, role } = req.body;
    const currentUser = req.user;
    if (currentUser.role === "admin" && role !== "dispatcher")
      return res.status(403).json({ error: "Нет прав" });

    const existing = await User.findOne({ where: { phone } });
    if (existing) return res.status(400).json({ error: "Телефон занят" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      phone,
      passwordHash,
      role,
      name: name || role,
      isActive: true,
    });
    return res.json({
      success: true,
      user: { id: user.id, phone: user.phone, role: user.role },
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: login (Вход в Систему) -> phone, passwordHash, isActive, role, name, id [Public]
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ where: { phone } });
    if (!user || !user.isActive)
      return res.status(400).json({ error: "Ошибка входа" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Ошибка входа" });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return res.json({
      success: true,
      token,
      user: { id: user.id, phone: user.phone, role: user.role },
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: getMe (Мой Профиль) -> id, phone, name, role [Auth_User]
export const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: listUsers (Список Пользователей) -> id, phone, name, role, isActive [Admin, Superadmin]
export const listUsers = async (req, res) => {
  try {
    const { rows, count } = await User.findAndCountAll({ limit: 20 });
    // (упростил код для примера, твоя логика остается прежней)
    return res.json({ success: true, rows, count });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: getUserById (Получить по ID) -> id, phone, name, role, isActive [Admin, Superadmin]
export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json(user);
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: updateUser (Обновление Данных) -> name, phone, role, isActive [Admin, Superadmin]
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    // Логика обновления...
    await user.save();
    return res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: deleteUser (Деактивация) -> isActive [Admin, Superadmin]
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.isActive = false;
    await user.save();
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: updateUserPasswordBySuperAdmin (Смена Пароля Admin) -> passwordHash [Superadmin]
export const updateUserPasswordBySuperAdmin = async (req, res) => {
  try {
    /* Логика смены пароля */
    return res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};
