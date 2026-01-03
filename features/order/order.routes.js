import { Router } from "express";
import {
  createOrder,
  listOrders,
  getOrderById,
  acceptOrder,
  updateOrderStatus,
  finishOrder
} from "./order.controller.js"; // Проверь путь
import { authMiddleware, requireRoles } from "../../middlewares/auth.middleware.js";

const router = Router();

// 1. Создать заказ (может клиент, может диспетчер)
router.post(
    "/", 
    authMiddleware, 
    createOrder
);

// 2. Список заказов (Админ видит все, можно добавить логику фильтра для водителей)
router.get(
    "/", 
    authMiddleware, 
    listOrders
);

// 3. Детали заказа
router.get(
    "/:id", 
    authMiddleware, 
    getOrderById
);

// --- ВОДИТЕЛЬСКИЕ ДЕЙСТВИЯ ---

// 4. Взять заказ
router.post(
    "/accept", 
    authMiddleware, 
    requireRoles(["driver"]), 
    acceptOrder
);

// 5. Смена статуса (Приехал, Поехали)
router.put(
    "/:id/status", 
    authMiddleware, 
    requireRoles(["driver", "admin"]), 
    updateOrderStatus
);

// 6. Завершить заказ (Финиш)
router.post(
    "/:id/finish", 
    authMiddleware, 
    requireRoles(["driver", "admin"]), 
    finishOrder
);

export default router;