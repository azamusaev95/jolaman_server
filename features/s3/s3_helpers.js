import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import mime from "mime-types";

dotenv.config();

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

// 👇 Добавил contentType в аргументы
export const uploadFile = async (filePath, fileName, contentType = null) => {
  try {
    const fileStream = fs.createReadStream(filePath);

    // Если contentType не передали, пробуем определить сами
    const type =
      contentType || mime.lookup(fileName) || "application/octet-stream";

    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: fileName,
      Body: fileStream,
      ContentType: type,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    // Возвращаем ссылку
    // ВАЖНО: Убедись, что формат ссылки правильный для твоего провайдера S3 (AWS, DigitalOcean, Minio?)
    return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error("Ошибка загрузки в S3:", error);
    throw error;
  }
};
