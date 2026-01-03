/**
 * @map_model DriverTransaction
 * @field id {UUID} - Уникальный ID транзакции
 * @field driverId {UUID} - ID водителя (Кошелек)
 * @field orderId {UUID} - ID заказа (за что списание/начисление)
 * @field amount {Decimal} - Сумма операции
 * @field type {Enum} - Тип (deposit, bonus, commission, withdrawal, penalty, subscription)
 * @field description {String} - Комментарий или причина
 * @field balanceAfter {Decimal} - Снимок баланса после операции (для сверки)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
// Импортируем модели, с которыми будем связываться
import Driver from "../driver/driver.model.js";
import Order from "../order/order.model.js";

const DriverTransaction = sequelize.define(
  "DriverTransaction",
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
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "order_id",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    type: {
      type: DataTypes.ENUM(
        "deposit", // + Пополнение
        "bonus", // + Бонус
        "order_commission", // - Комиссия заказа
        "withdrawal", // - Вывод средств
        "penalty", // - Штраф
        "subscription" // - Абонентская плата
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "balance_after",
    },
  },
  {
    tableName: "driver_transactions",
    timestamps: true,
    underscored: true,
  }
);

// АССОЦИАЦИИ
DriverTransaction.belongsTo(Driver, { foreignKey: "driverId", as: "driver" });
DriverTransaction.belongsTo(Order, { foreignKey: "orderId", as: "order" });

export default DriverTransaction;
