import express from "express";
import multer from "multer";
import {
  submitDriverApplication,
  getAllApplications,
  getApplicationById,
  processApplication,
} from "./driverApplication.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Временная папка

// Настройка полей файлов
const cpUpload = upload.fields([
  { name: "carTechPassport", maxCount: 1 },
  { name: "passportFront", maxCount: 1 },
  { name: "passportBack", maxCount: 1 },
  { name: "driverLicenseFront", maxCount: 1 },
  { name: "driverLicenseBack", maxCount: 1 },
  { name: "selfieWithPassport", maxCount: 1 },
]);

// 1. POST: Отправка заявки (ты просил назвать путь /application)
router.post("/application", cpUpload, submitDriverApplication);

// 2. GET: Список всех заявок (можно добавить ?status=pending)
router.get("/", getAllApplications);

// 3. GET: Детали одной заявки
router.get("/:id", getApplicationById);

// 4. PUT: Обработка (Одобрить или Отклонить)
// Пример JSON тела: { "status": "approved" } или { "status": "rejected", "comment": "Плохое фото" }
router.put("/:id/process", processApplication);

export default router;
