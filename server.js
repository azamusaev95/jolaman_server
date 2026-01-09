// server.js

import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import sequelize from "./config/db.js";
import app from "./app.js";
import { setupLogger } from "./utils/logger.js";

import { registerChatSockets } from "./socket/chat.socket.js";
import { registerDebugSockets } from "./socket/debug.socket.js";

const PORT = process.env.PORT || 8787;
const httpServer = createServer(app);

// --- Socket.io (один io, два namespace: /chat и /debug) ---
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// io доступен в контроллерах
app.set("io", io);

// логгер (получаем оригинальную консоль)
const originalConsole = setupLogger(io);

// ✅ чат: /chat
registerChatSockets(io, originalConsole);

// ✅ debug: /debug (network + console)
registerDebugSockets(io, originalConsole);

async function start() {
  try {
    await sequelize.authenticate();
    // originalConsole.log("🛠 DB: sync(alter) started...");
    // await sequelize.sync({ alter: true });
    // originalConsole.log("✅ DB: sync(alter) finished successfully");

    originalConsole.log("✅ DB connection OK");

    httpServer.listen(PORT, "0.0.0.0", () => {
      originalConsole.log(`🚀 Shumkar Server running on port ${PORT}`);
      originalConsole.log(`💬 Chat namespace: /chat`);
      originalConsole.log(`🐞 Debug namespace: /debug`);
    });
  } catch (err) {
    originalConsole.error("❌ DB init error:", err);
    process.exit(1);
  }
}

start();
