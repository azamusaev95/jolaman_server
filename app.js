import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import sequelize from "./config/db.js";

// Импорт маршрутов
import userRoutes from "./features/user/user.routes.js";
import carBrandsRoutes from "./features/carBrands/carBrands.routes.js";
import dropTableByName from "./features/dropTable/dropTableRouter.js";
import driverRoutes from "./features/driver/driver.routes.js";
import clientRoutes from "./features/client/client.routes.js";
import vehicleRoutes from "./features/vehicle/vehicle.routes.js";
import tariffRoutes from "./features/tariff/tariff.routes.js";
import orderRoutes from "./features/order/order.routes.js";
import chatRoutes from "./features/chat/chat.routes.js";
import driverTransaction from "./features/driverTransaction/transaction.routes.js";
import driverApplicationRoutes from "./features/driverApplication/driverApplication.routes.js";
import reviewRoutes from "./features/review/review.routes.js";
import photoControlRoutes from "./features/photoControl/photoControl.routes.js";
import selfieControlRoutes from "./features/selfieControl/selfieControl.routes.js";

const app = express();
const httpServer = createServer(app);

/**
 * [SENIOR CONFIG]: Инициализация Socket.io
 * Настройки оптимизированы для Railway (увеличены таймауты для стабильности прокси).
 */
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/**
 * 🔥 ВАЖНО ДЛЯ КОНТРОЛЛЕРОВ:
 * Сохраняем экземпляр io в настройках app.
 * Это позволяет в любом контроллере вызвать: req.app.get("io")
 */
app.set("io", io);

/**
 * ПЕРЕХВАТЧИК КОНСОЛИ БЭКЕНДА
 * Все console.log сервера дублируются в Dashboard.
 */
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

["log", "warn", "error"].forEach((method) => {
  console[method] = (...args) => {
    // Печать в стандартный лог Railway
    originalConsole[method].apply(console, args);

    try {
      if (io) {
        const content = args.length > 1 ? args : args[0];
        io.emit("backend_log", {
          level: method,
          message: typeof content === "string" ? content : "Object Log",
          context: content,
          time: new Date().toLocaleTimeString(),
        });
      }
    } catch (e) {
      // Игнорируем ошибки сериализации
    }
  };
});

app.use(cors());
app.use(express.json({ limit: "256kb" }));

/**
 * [DEBUG API]: Список всех таблиц БД
 */
app.get("/api/debug/tables", async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    res.json({ success: true, tables: results.map((r) => r.table_name) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * [DEBUG API]: Данные конкретной таблицы
 */
app.get("/api/debug/table/:name", async (req, res) => {
  try {
    const tableName = req.params.name;
    const [results] = await sequelize.query(
      `SELECT * FROM "${tableName}" LIMIT 100`
    );
    res.json({
      success: true,
      rows: results,
      ts: new Date().toLocaleTimeString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Регистрация API маршрутов
app.use("/api/users", userRoutes);
app.use("/api", carBrandsRoutes);
app.use("/api", dropTableByName);
app.use("/api/drivers", driverRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/tariffs", tariffRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/transactions", driverTransaction);
app.use("/api/driver-applications", driverApplicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/photo-control", photoControlRoutes);
app.use("/api/selfie-control", selfieControlRoutes);

/**
 * [REAL-TIME LOGIC]: Обработка соединений
 */
io.on("connection", (socket) => {
  originalConsole.log(`🔌 New connection: ${socket.id}`);

  /**
   * 🏠 ROOMS LOGIC:
   * Когда мобильное приложение или админ-панель открывают конкретный чат,
   * они должны вызвать socket.emit("join_chat", chatId);
   */
  socket.on("join_chat", (chatId) => {
    if (chatId) {
      socket.join(chatId);
      originalConsole.log(`📂 Socket ${socket.id} joined room: ${chatId}`);
    }
  });

  // Логи консоли от приложения (для отладки)
  socket.on("app_log", (data) => {
    io.emit("log_to_browser", data);
  });

  // Сетевые запросы от приложения (для отладки)
  socket.on("app_network", (data) => {
    io.emit("network_to_browser", data);
  });

  socket.on("disconnect", () => {
    originalConsole.log(`❌ Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8787;

async function start() {
  try {
    // 1. Проверяем соединение с БД
    await sequelize.authenticate();
    console.log("✅ DB connection OK");

    // 2. Запуск сервера
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Shumkar Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ DB init error:", err);
    process.exit(1);
  }
}

start();

export default app;
