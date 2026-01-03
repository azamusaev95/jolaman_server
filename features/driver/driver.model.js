/**
 * @map_model Driver
 * @field id {UUID} - Уникальный ID водителя
 * @field firstName {String} - Имя
 * @field lastName {String} - Фамилия
 * @field phone {String} - Телефон (Логин)
 * @field pin {String} - ПИН/ИНН (Уникальный идентификатор гражданина)
 * @field passportNumber {String} - Номер паспорта
 * @field licenseNumber {String} - Номер водительского удостоверения
 * @field balance {Decimal} - Текущий баланс (заработок)
 * @field rating {Float} - Рейтинг (1.0 - 5.0)
 * @field status {String} - Статус (pending, active, blocked, on_shift)
 * @field workType {String} - Тип работы (taxi, courier_auto, truck, etc.)
 * @field currentLat {Float} - Текущая широта (GPS)
 * @field currentLon {Float} - Текущая долгота (GPS)
 * @field isOnline {Boolean} - На линии / Офлайн
 * @field fcmToken {String} - Push-токен для заказов
 * @field passwordHash {String} - Хэш пароля
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Driver = sequelize.define(
  "Driver",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // --- Основная информация ---
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "first_name",
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "last_name",
    },
    middleName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "middle_name",
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pin: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    // 👇 ДОБАВЛЕНО ПОЛЕ ПАСПОРТА
    passportNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "passport_number",
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // --- Данные ВУ ---
    licenseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "license_number",
    },
    licenseCountry: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "license_country",
    },
    licenseIssueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "license_issue_date",
    },
    licenseExpiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "license_expiry_date",
    },
    experienceStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "experience_start_date",
    },
    isHearingImpaired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_hearing_impaired",
    },

    // --- Бизнес-логика ---
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      allowNull: false,
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 5.0,
      allowNull: false,
    },

    // Статус как строка (вместо ENUM)
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
      allowNull: false,
      validate: {
        isIn: {
          args: [["active", "blocked", "pending", "on_shift"]],
          msg: "Недопустимый статус водителя",
        },
      },
    },

    // Тип работы как строка (вместо ENUM)
    workType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "taxi",
      field: "work_type",
      validate: {
        isIn: {
          args: [
            [
              "taxi",
              "courier_foot",
              "courier_bike",
              "courier_moto",
              "courier_auto",
              "truck",
            ],
          ],
          msg: "Недопустимый тип работы",
        },
      },
    },

    // --- Технические поля ---
    currentLat: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "current_lat",
    },
    currentLon: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "current_lon",
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_online",
    },
    fcmToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fcm_token",
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash",
    },
  },
  {
    tableName: "drivers",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["phone"] },
      { unique: true, fields: ["license_number"] },
      { unique: true, fields: ["passport_number"] },
      { fields: ["status", "is_online"] },
      { fields: ["work_type"] },
    ],
  }
);

export default Driver;
