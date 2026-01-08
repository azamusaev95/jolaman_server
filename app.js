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

// 1. ИНИЦИАЛИЗАЦИЯ SOCKET.IO
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  // path: "/socket.io", // можно раскомментить, если прокси требует явный path
});

// 2. СОХРАНЕНИЕ IO В APP
app.set("io", io);

// 3. ПЕРЕХВАТЧИК ЛОГОВ
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

["log", "warn", "error"].forEach((method) => {
  console[method] = (...args) => {
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
    } catch (e) {}
  };
});

app.use(cors());
app.use(express.json({ limit: "256kb" }));

// 4. API ROUTES
app.get("/api/debug/tables", async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    res.json({ success: true, tables: results.map((r) => r.table_name) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// 5. ЛОГИКА СОКЕТОВ
io.on("connection", (socket) => {
  originalConsole.log(`🔌 [SOCKET] New connection: ${socket.id}`);

  // Вход в канал админов
  socket.on("join_admin", () => {
    socket.join("admins");
    originalConsole.log(`🛡️ [SOCKET] ${socket.id} joined ADMIN channel`);
  });

  // Вход в конкретный чат
  socket.on("join_chat", (chatId) => {
    if (!chatId) return;
    const roomName = String(chatId);
    socket.join(roomName);
    originalConsole.log(`📂 [SOCKET] ${socket.id} joined room: ${roomName}`);
  });

  socket.on("disconnect", (reason) => {
    originalConsole.log(
      `❌ [SOCKET] Disconnected: ${socket.id} | reason=${reason}`
    );
  });
});

const PORT = process.env.PORT || 8787;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connection OK");
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
