// src/controllers/fileController.js
import fs from "fs";
import mime from "mime-types";
import { uploadFile } from "./s3_helpers.js";

export const uploadFileController = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Файлы не загружены" });
    }

    const fileUrls = [];

    for (const file of files) {
      const contentType =
        mime.lookup(file.originalname) || "application/octet-stream";
      const fileUrl = await uploadFile(
        file.path,
        file.originalname,
        contentType
      );
      fileUrls.push(fileUrl);

      // Удаляем временный файл после загрузки
      fs.unlink(file.path, (err) => {
        if (err) console.error("Ошибка удаления файла:", err);
      });
    }

    res.json(fileUrls);
  } catch (error) {
    console.error("Ошибка загрузки файлов:", error);
    res.status(500).json({ error: "Ошибка загрузки файлов" });
  }
};
