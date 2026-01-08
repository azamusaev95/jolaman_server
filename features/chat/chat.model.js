/**
 * @map_model Chat
 * @field id {UUID} - Уникальный ID чата
 * @field type {String} - order | support_client | support_driver | broadcast_driver | broadcast_client | system_driver | system_client
 * @field status {String} - active | closed | archived
 * @field orderId {UUID} - Ссылка на Заказ (для типа order)
 * @field clientId {UUID} - Ссылка на Клиента (для order/support_client/system_client)
 * @field driverId {UUID} - Ссылка на Водителя (для order/support_driver/system_driver)
 * @field adminId {UUID} - Ссылка на Админа (кто создал/ведет поддержку/рассылку)
 * @field title {String} - Заголовок (например, "Акция: Бонус 10%")
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

    /**
     * order: Чат по конкретному заказу (Клиент <-> Водитель)
     * support_client: Чат поддержки клиента (Клиент <-> Админ)
     * support_driver: Чат поддержки водителя (Водитель <-> Админ)
     *
     * broadcast_driver: Рассылка водителям (Админ -> Всем водителям) - ОТВЕТ ЗАПРЕЩЕН
     * broadcast_client: Рассылка клиентам (Админ -> Всем клиентам) - ОТВЕТ ЗАПРЕЩЕН
     *
     * system_driver: Личное системное уведомление водителю (Система/Админ -> Водителю) - ОТВЕТ ЗАПРЕЩЕН
     * system_client: Личное системное уведомление клиенту (Система/Админ -> Клиенту) - ОТВЕТ ЗАПРЕЩЕН
     */
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "order",
      validate: {
        isIn: [
          [
            "order",
            "support_client",
            "support_driver",
            "broadcast_driver",
            "broadcast_client",
            "system_driver",
            "system_client",
          ],
        ],
      },
    },

    status: {
      type: DataTypes.STRING,
      defaultValue: "active",
      validate: {
        isIn: [["active", "closed", "archived"]],
      },
    },

    // Заголовок для новостей/акций/системных уведомлений
    title: {
      type: DataTypes.STRING,
      allowNull: true,
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

console.log(
  "🔗 Chat Model: Связи обновлены (broadcast_driver/broadcast_client/system_driver/system_client добавлены)"
);

export default Chat;
