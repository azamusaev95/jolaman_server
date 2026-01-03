/**
 * @map_model Tariff
 * @field id {UUID} - Уникальный ID
 * @field category {String} - Категория (taxi, delivery, cargo)
 * @field name {String} - Техническое имя (econom, business...)
 * @field basePrice {Decimal} - Стоимость подачи
 * @field pricePerKm {Decimal} - Цена за километр
 * @field pricePerMinute {Decimal} - Цена за минуту
 * @field waitingPrice {Decimal} - Цена ожидания
 * @field isActive {Boolean} - Активность тарифа
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Tariff = sequelize.define(
  "Tariff",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Категория тарифа (Группировка)
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [["taxi", "delivery", "cargo"]],
          msg: "Категория должна быть: taxi, delivery или cargo",
        },
      },
    },

    // Техническое имя тарифа
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isIn: {
          args: [
            [
              "econom",
              "comfort",
              "comfortPlus",
              "business",
              "courier_foot", // Пеший курьер
              "courier_bike", // Велосипед / Электровелосипед
              "courier_moto", // Мотоцикл
              "courier_car", // Курьер на авто
              "cargo_driver", // Грузовое авто
            ],
          ],
          msg: "Неверное название тарифа.",
        },
      },
    },

    // Цена за посадку (минималка)
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "base_price",
      validate: { min: 0 },
    },

    // Цена за 1 км
    pricePerKm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "price_per_km",
      validate: { min: 0 },
    },

    // Цена за 1 минуту в пути
    pricePerMinute: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "price_per_minute",
      validate: { min: 0 },
    },

    // Цена за 1 минуту ожидания
    waitingPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "waiting_price",
      validate: { min: 0 },
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: "is_active",
    },
  },
  {
    tableName: "tariffs",
    timestamps: true,
    underscored: true,
  }
);

export default Tariff;
