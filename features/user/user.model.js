/**
 * @map_model User
 * @field id {UUID} - Уникальный ID (генерируется автоматически)
 * @field phone {String} - Номер телефона (используется как логин)
 * @field passwordHash {String} - Хэш пароля (зашифровано bcrypt)
 * @field role {String} - Роль (superadmin, admin, dispatcher, park)
 * @field name {String} - Имя пользователя или название парка
 * @field isActive {Boolean} - Статус (false = удален/заблокирован)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash",
    },

    role: {
      type: DataTypes.STRING, // superadmin, admin, dispatcher, park
      allowNull: false,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: "is_active",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["phone"],
      },
    ],
  }
);

export default User;
