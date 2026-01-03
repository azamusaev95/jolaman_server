/**
 * @map_model Client
 * @field id {UUID} - Уникальный ID
 * @field phone {String} - Номер телефона (Логин)
 * @field passwordHash {String} - Пароль (если используется)
 * @field name {String} - Имя клиента
 * @field rating {Decimal} - Рейтинг (по умолчанию 5.0)
 * @field language {String} - Язык (ru, kg, en)
 * @field fcmToken {String} - Push-токен (Firebase)
 * @field bonusBalance {Decimal} - Бонусы на счету
 * @field isActive {Boolean} - Статус (false = заблокирован)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Client = sequelize.define(
  "Client",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Главный идентификатор
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        // Можно добавить регулярку для проверки формата номера
        notEmpty: true,
      },
    },

    // Пароль (или хеш код из СМС, если вход без пароля)
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true, // Может быть null, если вход чисто по OTP коду каждый раз
      field: "password_hash",
    },

    // Имя (как ты и хотел)
    name: {
      type: DataTypes.STRING,
      allowNull: true, // Сначала человек вводит телефон, имя может заполнить позже
    },

    // Рейтинг пассажира (водители видят)
    rating: {
      type: DataTypes.DECIMAL(3, 2), // Например: 4.95
      defaultValue: 5.0,
      allowNull: false,
    },

    // Предпочитаемый язык (ru, kg, en)
    language: {
      type: DataTypes.STRING(10),
      defaultValue: "ru",
    },

    // Токен для Push-уведомлений (Firebase Cloud Messaging)
    fcmToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fcm_token",
    },

    // Баланс (бонусы)
    bonusBalance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: "bonus_balance",
    },

    // Статус (активен или заблокирован за нарушения)
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "clients",
    timestamps: true,
    underscored: true,
  }
);

export default Client;
