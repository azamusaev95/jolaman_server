import Vehicle from "./vehicle.model.js";
import CarModel from "../carBrands/carBrands.model.js";
import VehiclePhoto from "./vehicle-photo.model.js";
import { Op } from "sequelize";

// HELPERS
const calculateAllowedTariffs = (vehicleYear, carModelRules) => {
  const tariffs = [];
  if (carModelRules.minYearEconom && vehicleYear >= carModelRules.minYearEconom)
    tariffs.push("econom");
  if (
    carModelRules.minYearComfort &&
    vehicleYear >= carModelRules.minYearComfort
  )
    tariffs.push("comfort");
  if (
    carModelRules.minYearComfortPlus &&
    vehicleYear >= carModelRules.minYearComfortPlus
  )
    tariffs.push("comfort_plus");
  if (
    carModelRules.minYearBusiness &&
    vehicleYear >= carModelRules.minYearBusiness
  )
    tariffs.push("business");
  if (
    carModelRules.powertrain === "ev" &&
    carModelRules.minYearElectro &&
    vehicleYear >= carModelRules.minYearElectro
  )
    tariffs.push("electro");
  return tariffs;
};

// @map: createVehicle (Добавить ТС) -> brand, model, year, licensePlate, vin, sts, type, status, allowedTariffs [Driver, Admin]
export const createVehicle = async (req, res) => {
  try {
    const {
      type = "car",
      brand,
      model,
      year,
      licensePlate,
      vin,
      sts,
      steeringWheel,
      transmission,
      color,
      loadCapacity,
      bodyType,
      cargoDimensions,
    } = req.body;

    // --- 1. ВАЛИДАЦИЯ ---
    if (!brand || !model || !year || !licensePlate || !color || !vin || !sts) {
      return res.status(400).json({
        message: "Марка, Модель, Год, Госномер, Цвет, VIN и СТС обязательны.",
      });
    }

    let vehicleData = {
      type,
      brand: String(brand).trim(),
      model: String(model).trim(),
      year: Number(year),
      color: String(color).trim(),
      licensePlate: licensePlate.toUpperCase().replace(/\s/g, ""),
      vin: vin.toUpperCase().trim(),
      sts: String(sts).trim(),
      steeringWheel,
      transmission,
      status: "active",
      allowedTariffs: [],
      options: {},
    };

    // --- 2. ЛОГИКА ---
    if (type === "car") {
      if (steeringWheel !== "left") {
        return res.status(400).json({ message: "Только левый руль." });
      }

      const allowedModel = await CarModel.findOne({
        where: {
          make: { [Op.iLike]: vehicleData.brand },
          model: { [Op.iLike]: vehicleData.model },
          isActive: true,
        },
      });

      if (!allowedModel) {
        return res
          .status(400)
          .json({
            message: `Модель ${vehicleData.brand} ${vehicleData.model} не разрешена.`,
          });
      }

      // Здесь должна быть логика расчета тарифов
      vehicleData.allowedTariffs = ["econom"];
    } else if (type === "truck") {
      // Логика для грузовиков
      vehicleData.allowedTariffs = ["cargo"];
    }

    // --- 3. СОХРАНЕНИЕ ---
    const newVehicle = await Vehicle.create(vehicleData);
    return res.status(201).json(newVehicle);
  } catch (error) {
    console.error("Error createVehicle:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ message: "Дубликат данных (Госномер/VIN)." });
    }
    return res.status(500).json({ message: "Ошибка сервера." });
  }
};

// @map: getVehicles (Список ТС) -> licensePlate, brand, model, status [Admin, Dispatcher]
export const getVehicles = async (req, res) => {
  try {
    const { type, search, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    if (search) {
      const cleanSearch = search.trim();
      where[Op.or] = [
        { licensePlate: { [Op.iLike]: `%${cleanSearch}%` } },
        { vin: { [Op.iLike]: `%${cleanSearch}%` } },
        { brand: { [Op.iLike]: `%${cleanSearch}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows, count } = await Vehicle.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      items: rows,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error getVehicles:", error);
    return res.status(500).json({ message: "Ошибка получения списка." });
  }
};

// @map: getVehicleById (Детали ТС) -> id, photos, brand, model [Admin, Dispatcher]
export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByPk(id, {
      include: [
        {
          model: VehiclePhoto,
          as: "photos",
          attributes: ["id", "imageUrl", "type", "status", "rejectionReason"],
        },
      ],
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Транспорт не найден." });
    }

    return res.json(vehicle);
  } catch (error) {
    console.error("Error getVehicleById:", error);
    return res.status(500).json({ message: "Ошибка сервера." });
  }
};

// @map: updateVehicle (Обновить ТС) -> color, licensePlate, status, allowedTariffs [Admin]
export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle)
      return res.status(404).json({ message: "Транспорт не найден." });

    // Упрощенная логика обновления
    if (body.color) vehicle.color = body.color;
    if (body.status) vehicle.status = body.status;

    await vehicle.save();
    return res.json(vehicle);
  } catch (error) {
    console.error("Error updateVehicle:", error);
    return res.status(500).json({ message: "Ошибка обновления." });
  }
};

// @map: deleteVehicle (Удалить ТС) -> id [Admin]
export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Vehicle.destroy({ where: { id } });

    if (!deleted)
      return res.status(404).json({ message: "Транспорт не найден." });

    return res.json({ message: "Транспорт удален." });
  } catch (error) {
    console.error("Error deleteVehicle:", error);
    return res.status(500).json({ message: "Ошибка удаления." });
  }
};
