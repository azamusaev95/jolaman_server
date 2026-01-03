/**
 * @map_model CarModel
 * @field id {UUID} - Уникальный ID (генерируется автоматически)
 * @field make {String} - Марка автомобиля (например, Toyota)
 * @field model {String} - Модель автомобиля (например, Camry)
 * @field doors {Integer} - Количество дверей
 * @field powertrain {String} - Тип двигателя (ice = ДВС, ev = Электро)
 * @field minYearEconom {Integer} - Мин. год для тарифа Эконом (null = нельзя)
 * @field minYearElectro {Integer} - Мин. год для тарифа Электро
 * @field minYearComfort {Integer} - Мин. год для тарифа Комфорт
 * @field minYearComfortPlus {Integer} - Мин. год для тарифа Комфорт+
 * @field minYearBusiness {Integer} - Мин. год для тарифа Бизнес
 * @field isActive {Boolean} - Активность справочника (false = скрыт)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const CarModel = sequelize.define(
  "CarModel",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    make: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Марка (Audi, Toyota, Mercedes-Benz)",
    },

    model: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Модель (A4, Camry, C-klasse)",
    },

    doors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      comment: "Количество дверей",
    },

    powertrain: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ice",
      validate: {
        isIn: {
          args: [["ice", "ev"]],
          msg: "Неверный тип двигателя",
        },
      },
    },
    minYearEconom: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "min_year_econom",
      validate: { min: 1900 },
      comment: "Минимальный год для тарифа Эконом (NULL = не допускается)",
    },

    minYearElectro: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "min_year_electro",
      validate: { min: 1900 },
      comment: "Минимальный год для тарифа Электро (NULL = не допускается)",
    },

    minYearComfort: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "min_year_comfort",
      validate: { min: 1900 },
      comment: "Минимальный год для тарифа Комфорт (NULL = не допускается)",
    },

    minYearComfortPlus: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "min_year_comfort_plus",
      validate: { min: 1900 },
      comment: "Минимальный год для тарифа Комфорт+ (NULL = не допускается)",
    },

    minYearBusiness: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "min_year_business",
      validate: { min: 1900 },
      comment: "Минимальный год для тарифа Бизнес (NULL = не допускается)",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: "is_active",
    },
  },
  {
    tableName: "car_models",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["make", "model"],
        name: "car_models_make_model_unique",
      },
    ],
  }
);

export default CarModel;
