import express from "express";
import cors from "cors";
import sequelize from "./config/db.js";

// Импорт маршрутов (ПЕРЕНЕСЕНО из index.js)
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

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "256kb" }));

// API ROUTES
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

// ПЕРЕНЕСЕНО: Регистрация роутов
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

export default app;
