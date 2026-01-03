/**
 * @map_model Order
 * @field id {UUID} - ID заказа
 * @field publicNumber {String} - Короткий номер для клиента (например, 4521)
 * @field status {Enum} - (new, driver_assigned, driver_arrived, in_progress, completed, cancelled)
 * @field clientId {UUID} - Кто заказал
 * @field driverId {UUID} - Кто везет
 * @field tariffId {UUID} - По какому тарифу
 * @field fromAddress {String} - Адрес подачи
 * @field toAddress {String} - Адрес назначения
 * @field estimatedPrice {Decimal} - Предварительная цена
 * @field finalPrice {Decimal} - Итоговая цена (по таксометру)
 * @field paymentMethod {Enum} - cash, card, bonus
 * @field isPaid {Boolean} - Оплачен ли заказ
 * @field distanceKm {Float} - Фактическое расстояние
 * @field durationMin {Float} - Фактическое время в пути
 * @field scheduledAt {Date} - Время предварительного заказа (если есть)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

import OrderRoutePoint from "../orderRoutePoint/orderRoutePoint.model.js";
import Tariff from "../tariff/tariff.model.js";
import Driver from "../driver/driver.model.js";
import Client from "../client/client.model.js";

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    publicNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "public_number",
    },

    // --- ВНЕШНИЕ КЛЮЧИ ---
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "client_id",
    },
    driverId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "driver_id",
    },
    tariffId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "tariff_id",
    },
    dispatcherId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "dispatcher_id",
    },

    // --- СТАТУС ---
    status: {
      type: DataTypes.ENUM(
        "new",
        "driver_assigned",
        "driver_arrived",
        "in_progress",
        "completed",
        "cancelled"
      ),
      defaultValue: "new",
      allowNull: false,
    },
    cancelReason: {
      type: DataTypes.STRING,
      field: "cancel_reason",
    },

    // --- АДРЕСА ---
    fromAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "from_address",
    },
    fromLat: { type: DataTypes.FLOAT, field: "from_lat" },
    fromLng: { type: DataTypes.FLOAT, field: "from_lng" },

    toAddress: {
      type: DataTypes.STRING,
      field: "to_address",
    },
    toLat: { type: DataTypes.FLOAT, field: "to_lat" },
    toLng: { type: DataTypes.FLOAT, field: "to_lng" },

    // --- ДЕНЬГИ ---
    estimatedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "estimated_price",
    },
    finalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      field: "final_price",
    },
    paymentMethod: {
      type: DataTypes.ENUM("cash", "card", "bonus"),
      defaultValue: "cash",
      field: "payment_method",
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_paid",
    },

    // --- ИНФО ---
    distanceKm: { type: DataTypes.FLOAT, field: "distance_km" },
    durationMin: { type: DataTypes.FLOAT, field: "duration_min" },
    comment: { type: DataTypes.STRING },

    // --- ВРЕМЯ ---
    scheduledAt: { type: DataTypes.DATE, field: "scheduled_at" },
    startedAt: { type: DataTypes.DATE, field: "started_at" },
    finishedAt: { type: DataTypes.DATE, field: "finished_at" },
  },
  {
    tableName: "orders",
    timestamps: true,
    underscored: true,
  }
);

// СВЯЗИ
Order.hasMany(OrderRoutePoint, {
  foreignKey: "orderId",
  as: "routePoints",
  onDelete: "CASCADE",
});
OrderRoutePoint.belongsTo(Order, {
  foreignKey: "orderId",
  as: "order",
});

Order.belongsTo(Tariff, {
  foreignKey: "tariffId",
  as: "tariff",
});

Order.belongsTo(Driver, {
  foreignKey: "driverId",
  as: "driver",
});

Order.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

console.log("🔗 Order Model: Связи инициализированы");

export default Order;
