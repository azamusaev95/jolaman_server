/**
 * @map_model Vehicle
 * @field id {UUID} - Уникальный ID автомобиля
 * @field type {String} - Тип ТС (car, truck и т.д., по умолчанию "car")
 * @field brand {String} - Марка (Toyota, Mercedes...)
 * @field model {String} - Модель (Camry, Sprinter...)
 * @field year {Integer} - Год выпуска
 * @field color {String} - Цвет кузова
 * @field licensePlate {String} - Госномер (уникальный, обязательный)
 * @field vin {String} - VIN код (опционально)
 * @field sts {String} - Номер СТС (опционально)
 * @field status {String} - Статус (active, repair, blocked)
 * @field options {JSONB} - Доп. свойства и опции (JSON объект)
 */

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

// 👇 1. Импортируем вторую модель СЮДА
import VehiclePhoto from "./vehicle-photo.model.js";

const Vehicle = sequelize.define(
  "Vehicle",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // ... Твои остальные поля (type, brand, model и т.д.) ...
    type: {
      type: DataTypes.STRING,
      defaultValue: "car",
    },
    brand: { type: DataTypes.STRING, allowNull: false },
    model: { type: DataTypes.STRING, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    color: { type: DataTypes.STRING, allowNull: false },
    licensePlate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "license_plate",
    },
    vin: { type: DataTypes.STRING },
    sts: { type: DataTypes.STRING },

    // ... (остальные поля грузовиков, опции и статус) ...
    status: {
      type: DataTypes.STRING,
      defaultValue: "active",
    },
    options: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: "vehicles",
    timestamps: true,
    underscored: true,
  }
);

// ==========================================
// 👇 2. ПИШЕМ СВЯЗИ ПРЯМО ТУТ (ЗА ДВОИХ)
// ==========================================

// Связь 1: Машина имеет много фото
Vehicle.hasMany(VehiclePhoto, {
  foreignKey: "vehicleId",
  as: "photos", // Это имя для include: ["photos"]
  onDelete: "CASCADE",
});

// Связь 2: Фото принадлежит машине
// Мы можем написать это здесь, так как импортировали VehiclePhoto выше
VehiclePhoto.belongsTo(Vehicle, {
  foreignKey: "vehicleId",
  as: "vehicle",
});

console.log(
  "🔗 Связи Vehicle <-> VehiclePhoto установлены внутри vehicle.model.js"
);

export default Vehicle;
