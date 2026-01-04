import "dotenv/config";
import express from "express";
import cors from "cors";

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

// 👇 НОВЫЙ ИМПОРТ: ЗАЯВКИ ВОДИТЕЛЕЙ
import driverApplicationRoutes from "./features/driverApplication/driverApplication.routes.js";
import reviewRoutes from "./features/review/review.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "256kb" }));

// Простой health-check
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use("/api/users", userRoutes);
app.use("/api", carBrandsRoutes);
app.use("/api", dropTableByName);

app.use("/api/drivers", driverRoutes); // Действующие водители
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/tariffs", tariffRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/transactions", driverTransaction);

// 👇 НОВЫЙ РОУТ: ЗАЯВКИ
app.use("/api/driver-applications", driverApplicationRoutes);
app.use("/api/review", reviewRoutes);

const PORT = process.env.PORT || 8787;

async function start() {
  try {
    console.log("⏳ Connecting to DB...");
    await sequelize.authenticate();
    console.log("✅ DB connection OK");

    console.log("⏳ Sync models (sequelize.sync)...");

    // await sequelize.sync({ alter: true });

    console.log("✅ Models synced");

    // 👇 ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ: Добавили '0.0.0.0'
    // Это разрешает доступ с телефона по Wi-Fi
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Shumkar Taxi API listening on port ${PORT} (accessible via Wi-Fi)`
      );
    });
  } catch (err) {
    console.error("❌ DB init error:", err);
    process.exit(1);
  }
}

start();

export default app;
