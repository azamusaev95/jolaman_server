// src/routes/fileRoutes.js
import express from "express";
import multer from "multer";
import { uploadFileController } from "./s3_controllers.js";

const upload = multer({ dest: "uploads/" }); // Временная папка для загрузки
const router = express.Router();

router.post("/upload", upload.array("images", 5), uploadFileController);

export default router;
