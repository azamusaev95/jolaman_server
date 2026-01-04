/**
 * @map_model Review
 * @field id {UUID} - ID отзыва
 * @field orderId {UUID} - Ссылка на заказ
 * @field reviewerId {UUID} - Кто оставил отзыв (ID)
 * @field targetId {UUID} - Кому оставили отзыв (ID)
 * @field targetRole {Enum} - Роль получателя (driver, client)
 * @field score {Integer} - Оценка (1-5)
 * @field comment {Text} - Текст комментария
 * @field status {String} - active | amnestied
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Ссылка на заказ
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "order_id",
    },

    // Кто пишет отзыв
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "reviewer_id",
    },

    // Кого оценивают
    targetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "target_id",
    },

    // Роль того, кого оценивают
    targetRole: {
      type: DataTypes.ENUM("driver", "client"),
      allowNull: false,
      field: "target_role",
    },

    // Оценка (1-5)
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },

    // Комментарий
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔹 Новый статус отзыва
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: {
          args: [["active", "amnestied"]],
          msg: "Invalid review status",
        },
      },
    },
  },
  {
    tableName: "reviews",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["target_id", "target_role"] },
      { fields: ["order_id"] },
      // 👉 при росте объёма можно добавить:
      // { fields: ["status"] }
    ],
  }
);

export default Review;
