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

    // ожидаем payload: { id, role: "driver" }
    if (payload.role !== "driver") {
      return res
        .status(403)
        .json({ message: "Доступ только для водителей", role: payload.role });
    }

    // кладем в запрос компактный объект
    req.user = {
      id: payload.id,
      role: payload.role,
    };

    return next();
  } catch (e) {
    console.error("authDriver error:", e);
    return res.status(500).json({ message: "Ошибка авторизации" });
  }
};
