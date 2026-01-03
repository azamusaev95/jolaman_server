import { Router } from "express";
import {
  changeDriverBalance,
  getDriverHistory,
  getAllTransactions, // 👈 1. Импортируем новую функцию
} from "./transaction.controller.js";

const router = Router();

// 1. Изменить баланс (+ или -)
// POST /api/transactions
router.post("/", changeDriverBalance);

// 2. Получить ВСЕ транзакции (для админки с фильтрами)
// GET /api/transactions?page=1&type=deposit&startDate=...
router.get("/", getAllTransactions); // 👈 2. Новый маршрут

// 3. История конкретного водителя
// GET /api/transactions/driver/:driverId
router.get("/driver/:driverId", getDriverHistory);

export default router;
