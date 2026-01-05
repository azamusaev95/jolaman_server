/**
 * @map_model SelfieControl
 * @field id {UUID} - ID записи
 * @field driverId {UUID} - Ссылка на водителя
 * @field date {Date} - Дата селфи
 * @field photo {String} - Ссылка на одно фото (селфи)
 * @field status {String} - pending | approved | rejected
 * @field rejectionReason {String} - Причина отказа
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const SelfieControl = sequelize.define(
  "SelfieControl",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    driverId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "driver_id",
    },

    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    // Для селфи нам достаточно одной строки (URL фото)
    photo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Photo URL cannot be empty" },
      },
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },

    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },
  },
  {
    tableName: "selfie_controls",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["driver_id"] },
      { fields: ["date"] },
      { fields: ["status"] },
    ],
  }
);

export default SelfieControl;
