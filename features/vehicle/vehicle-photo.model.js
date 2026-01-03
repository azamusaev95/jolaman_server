/**
 * @map_model VehiclePhoto
 * @field id {UUID} - ID фото
 * @field vehicleId {UUID} - Ссылка на транспорт
 * @field imageUrl {String} - Ссылка на файл
 * @field type {String} - Ракурс (front, back, interior, cargo...)
 * @field status {String} - Статус модерации (pending, approved, rejected)
 * @field rejectionReason {String} - Причина отказа (если есть)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const VehiclePhoto = sequelize.define(
  "VehiclePhoto",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Внешний ключ на таблицу vehicles
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "vehicle_id",
    },

    imageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "image_url",
      comment: "Ссылка на фото",
    },

    // Тип фото (включая специфику грузовиков)
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [
          [
            "front", // Спереди
            "back", // Сзади
            "left", // Слева
            "right", // Справа
            "interior_front", // Салон спереди
            "interior_back", // Салон сзади
            "trunk", // Багажник (для легковых)
            "cargo_space", // Грузовой отсек/Будка внутри (для грузовиков)
            "odometer", // Одометр/Пробег
            "damage", // Фото повреждений
            "branding", // Фото оклейки/брендинга
            "lightbox", // Фото лайтбокса
          ],
        ],
      },
    },

    // Статус модерации (диспетчер проверяет фото)
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },

    // Причина отказа (например: "Фото размыто" или "Грязная машина")
    rejectionReason: {
      type: DataTypes.STRING,
      field: "rejection_reason",
    },
  },
  {
    tableName: "vehicle_photos",
    timestamps: true,
    underscored: true,
  }
);

export default VehiclePhoto;
