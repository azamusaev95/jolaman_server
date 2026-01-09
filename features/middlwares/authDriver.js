// middlewares/authDriver.js

import jwt from "jsonwebtoken";

export const authDriver = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Токен не передан" });
    }

    const token = authHeader.split(" ")[1];

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Неверный или истёкший токен" });
    }

    if (!payload?.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // ✅ Жёстко фиксируем роль, так как этот middleware используется только для драйверских роутов
    req.user = {
      id: payload.id,
      role: "driver",
    };

    return next();
  } catch (e) {
    console.error("authDriver error:", e);
    return res.status(500).json({ message: "Ошибка авторизации" });
  }
};
