import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import sequelize from "./config/db.js";
import app from "./app.js";
import { setupLogger } from "./utils/logger.js";
import { registerSocketHandlers } from "./socket/socketHandlers.js";

const PORT = process.env.PORT || 8787;
const httpServer = createServer(app);

// Инициализация Socket.io
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ПЕРЕНЕСЕНО: Делаем io доступным в контроллерах через req.app.get('io')
app.set("io", io);

// ИЗМЕНЕНО: Инициализируем логгер и получаем оригинальную консоль
const originalConsole = setupLogger(io);

// ИЗМЕНЕНО: Регистрируем обработчики сокетов
registerSocketHandlers(io, originalConsole);

async function start() {
  try {
    await sequelize.authenticate();
    // ИЗМЕНЕНО: Используем оригинальную консоль здесь, так как логгер уже может перехватывать
    originalConsole.log("✅ DB connection OK");

    httpServer.listen(PORT, "0.0.0.0", () => {
      originalConsole.log(`🚀 Shumkar Server running on port ${PORT}`);
    });
  } catch (err) {
    originalConsole.error("❌ DB init error:", err);
    process.exit(1);
  }
}

start();
