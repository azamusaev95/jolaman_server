/**
 * @map_model PhotoControl
 * @field id {UUID} - ID записи фотоконтроля
 * @field driverId {UUID} - Ссылка на водителя
 * @field vehicleId {UUID} - Ссылка на автомобиль
 * @field date {Date} - Дата и время фотоконтроля
 * @field photos {JSON} - Массив ссылок на фото
 * @field status {String} - pending | approved | rejected
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PhotoControl = sequelize.define(
  "PhotoControl",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Водитель, к которому относится фотоконтроль
    driverId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "driver_id",
    },

    // Автомобиль, к которому относится фотоконтроль
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "vehicle_id",
    },

    // Дата и время проведения фотоконтроля
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // Массив ссылок на фото (JSON: ["url1", "url2", ...] или объекты)
    photos: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    // Статус фотоконтроля: pending | approved | rejected
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [["pending", "approved", "rejected"]],
          msg: "Invalid photo control status",
        },
      },
    },
  },
  {
    tableName: "photo_controls",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["driver_id"] },
      { fields: ["vehicle_id"] },
      { fields: ["date"] },
      // при необходимости:
      // { fields: ["status"] },
    ],
  }
);

export default PhotoControl;
