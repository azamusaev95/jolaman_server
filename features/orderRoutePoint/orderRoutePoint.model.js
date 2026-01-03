/**
 * @map_model OrderRoutePoint
 * @field id {UUID} - ID точки
 * @field orderId {UUID} - Ссылка на заказ
 * @field sequence {Integer} - Порядковый номер (1, 2, 3...)
 * @field address {String} - Адрес текстом
 * @field lat {Float} - Широта
 * @field lng {Float} - Долгота
 * @field isVisited {Boolean} - Посещена ли точка (true = водитель был здесь)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const OrderRoutePoint = sequelize.define(
  "OrderRoutePoint",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Ссылка на основной заказ
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "order_id",
    },

    // Порядковый номер (1, 2, 3...)
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Адрес точки (текст)
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Координаты
    lat: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    lng: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    // Статус: проехал водитель эту точку или нет
    isVisited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_visited",
    },
  },
  {
    tableName: "order_route_points",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["order_id"] }],
  }
);

export default OrderRoutePoint;
