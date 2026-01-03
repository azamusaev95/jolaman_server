import { Router } from "express";
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "./vehicle.contollers.js";

const router = Router();

// /api/vehicles
router.post("/", createVehicle); // Создать
router.get("/", getVehicles); // Получить список (с фильтрами)
router.get("/:id", getVehicleById); // Получить одну
router.patch("/:id", updateVehicle); // Обновить
router.delete("/:id", deleteVehicle); // Удалить

export default router;
