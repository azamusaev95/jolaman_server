/**
 * @map_model ChatMessage
 * @field id {UUID} - Уникальный ID сообщения
 * @field chatId {UUID} - ID чата, к которому относится сообщение
 * @field senderId {UUID} - ID отправителя (Driver, Client или Admin)
 * @field senderRole {String} - Роль отправителя (driver, client, admin)
 * @field contentType {String} - Тип (text, image, voice, system)
 * @field content {Text} - Текст сообщения или ссылка на файл
 * @field isRead {Boolean} - Статус прочтения (false = новое)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const ChatMessage = sequelize.define(
  "ChatMessage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chatId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "chat_id",
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "sender_id",
    },
    senderRole: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "sender_role",
    },
    contentType: {
      type: DataTypes.STRING,
      defaultValue: "text",
      field: "content_type",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_read",
    },
  },
  {
    tableName: "chat_messages",
    timestamps: true,
    underscored: true,
  }
);

export default ChatMessage;
