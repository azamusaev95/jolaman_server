/**
 * @map_model Chat
 * @field id {UUID} - Уникальный ID чата
 * @field type {String} - Тип чата (обычно 'order' или 'support')
 * @field status {String} - Статус (active, closed, archived)
 * @field orderId {UUID} - Ссылка на Заказ
 * @field clientId {UUID} - Ссылка на Клиента
 * @field driverId {UUID} - Ссылка на Водителя
 * @field adminId {UUID} - Ссылка на Админа (если участвует)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

// Импортируем модели для связей
import ChatMessage from "../chatMessage/chatMessage.model.js";
import Order from "../order/order.model.js";
import Client from "../client/client.model.js";
import Driver from "../driver/driver.model.js";

const Chat = sequelize.define(
  "Chat",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "order",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "active",
    },
    orderId: {
      type: DataTypes.UUID,
      field: "order_id",
      allowNull: true,
    },
    clientId: {
      type: DataTypes.UUID,
      field: "client_id",
      allowNull: true,
    },
    driverId: {
      type: DataTypes.UUID,
      field: "driver_id",
      allowNull: true,
    },
    adminId: {
      type: DataTypes.UUID,
      field: "admin_id",
      allowNull: true,
    },
  },
  {
    tableName: "chats",
    timestamps: true,
    underscored: true,
  }
);

// ======================================================
// СВЯЗИ
// ======================================================

Chat.hasMany(ChatMessage, {
  foreignKey: "chatId",
  as: "messages",
  onDelete: "CASCADE",
});
ChatMessage.belongsTo(Chat, {
  foreignKey: "chatId",
  as: "chat",
});

Chat.belongsTo(Order, {
  foreignKey: "orderId",
  as: "order",
});

Chat.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

Chat.belongsTo(Driver, {
  foreignKey: "driverId",
  as: "driver",
});

console.log("🔗 Chat Model: Связи инициализированы");

export default Chat;
