/**
 * @map_model PhotoControl & SelfieControl
 * Файл содержит модели для прохождения контроля: осмотр авто и селфи водителя.
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

// ИЗМЕНЕНО: Определение модели PhotoControl перенесено в общий файл
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
      defaultValue: DataTypes.NOW,
    },

    /**
     * Поле photos теперь содержит строгую валидацию.
     * Мы проверяем наличие всех 6 обязательных ракурсов перед сохранением.
     */
    photos: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        hasAllRequiredPhotos(value) {
          const requiredKeys = [
            "front", // спереди
            "left", // слева
            "right", // справа
            "trunk", // багажник
            "frontSeats", // передние сиденья
            "backSeats", // задние сиденья
          ];

          if (!value || typeof value !== "object") {
            throw new Error("Photos must be an object");
          }

          const missingKeys = requiredKeys.filter(
            (key) => !value[key] || value[key].trim() === ""
          );

          if (missingKeys.length > 0) {
            throw new Error(
              `Missing required photos: ${missingKeys.join(", ")}`
            );
          }
        },
      },
    },

    // Статус фотоконтроля
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

    // Комментарий от диспетчера (обязателен, если статус rejected — можно настроить логику в хуках)
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
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
      { fields: ["status"] },
    ],
  }
);

// ИЗМЕНЕНО: Определение модели SelfieControl перенесено в общий файл
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

// ИЗМЕНЕНО: Экспортируем обе модели вместе
export { PhotoControl, SelfieControl };
