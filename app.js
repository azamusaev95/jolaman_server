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

// Инициализация Socket.io Хаба
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * ПЕРЕХВАТЧИК КОНСОЛИ БЭКЕНДА
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

    // Отправка в Dashboard
    try {
      const content = args.length > 1 ? args : args[0];
      io.emit("backend_log", {
        level: method,
        message: typeof content === "string" ? content : "Object/Array Log",
        context: content,
        time: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      // Игнорируем ошибки сериализации
    }
  };
});

app.use(cors());
app.use(express.json({ limit: "256kb" }));

// Health-check
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Все API роуты
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

// Логика трансляции (Relay) событий от мобилки к браузеру
io.on("connection", (socket) => {
  originalConsole.log("🔌 Новое подключение к Debug Hub (App или Browser)");

  // Когда мобилка шлет лог -> пересылаем всем (в браузер)
  socket.on("app_log", (data) => {
    socket.broadcast.emit("log_to_browser", data);
  });

  // Когда мобилка шлет инфо о сети -> пересылаем в браузер
  socket.on("app_network", (data) => {
    socket.broadcast.emit("network_to_browser", data);
  });
});

const PORT = process.env.PORT || 8787;

async function start() {
  try {
    console.log("⏳ Connecting to DB...");
    await sequelize.authenticate();
    console.log("✅ DB connection OK");

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Shumkar API & Debug Hub running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ DB init error:", err);
    process.exit(1);
  }
}

start();

export default app;
