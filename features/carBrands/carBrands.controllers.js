import CarModel from "./carBrands.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js";

// -------------------------
// helpers
// -------------------------
const toIntOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pickUpdateFields = (body) => {
  const allowed = {};

  if (body.make !== undefined) allowed.make = String(body.make).trim();
  if (body.model !== undefined) allowed.model = String(body.model).trim();

  if (body.doors !== undefined) allowed.doors = toIntOrNull(body.doors);

  if (body.powertrain !== undefined) {
    const p = String(body.powertrain).trim();
    if (!["ice", "ev"].includes(p)) {
      throw new Error("INVALID_POWERTRAIN");
    }
    allowed.powertrain = p;
  }

  // years: allow null (means not allowed)
  if (body.minYearEconom !== undefined)
    allowed.minYearEconom = toIntOrNull(body.minYearEconom);
  if (body.minYearElectro !== undefined)
    allowed.minYearElectro = toIntOrNull(body.minYearElectro);
  if (body.minYearComfort !== undefined)
    allowed.minYearComfort = toIntOrNull(body.minYearComfort);
  if (body.minYearComfortPlus !== undefined)
    allowed.minYearComfortPlus = toIntOrNull(body.minYearComfortPlus);
  if (body.minYearBusiness !== undefined)
    allowed.minYearBusiness = toIntOrNull(body.minYearBusiness);

  if (body.isActive !== undefined) allowed.isActive = Boolean(body.isActive);

  return allowed;
};

const normalizeLike = (s) => `%${String(s).trim()}%`;

// @map: getCarModels (Список Моделей) -> make, model, isActive, powertrain, doors [Public/Auth]
export const getCarModels = async (req, res) => {
  try {
    const {
      make,
      q,
      isActive,
      powertrain,
      minDoors,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (make) where.make = String(make).trim();

    if (q) {
      const like = normalizeLike(q);
      where[Op.or] = [
        { make: { [Op.iLike]: like } },
        { model: { [Op.iLike]: like } },
      ];
    }

    if (isActive !== undefined) {
      // "true"/"false"
      where.isActive = String(isActive) === "true";
    }

    if (powertrain) {
      const p = String(powertrain).trim();
      if (!["ice", "ev"].includes(p)) {
        return res
          .status(400)
          .json({ message: "powertrain должен быть ice или ev" });
      }
      where.powertrain = p;
    }

    if (minDoors !== undefined) {
      const d = Number(minDoors);
      if (!Number.isFinite(d)) {
        return res.status(400).json({ message: "minDoors должен быть числом" });
      }
      where.doors = { [Op.gte]: d };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await CarModel.findAndCountAll({
      where,
      order: [
        ["make", "ASC"],
        ["model", "ASC"],
      ],
      limit: limitNum,
      offset,
    });

    return res.json({
      items: rows,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error("Error getCarModels:", error);
    return res.status(500).json({ message: "Ошибка при получении моделей" });
  }
};

// @map: getCarMakes (Список Марок) -> make, isActive [Public/Auth]
export const getCarMakes = async (req, res) => {
  try {
    const { isActive } = req.query;

    const where = {};
    if (isActive !== undefined) where.isActive = String(isActive) === "true";

    const rows = await CarModel.findAll({
      where,
      attributes: ["make"],
      group: ["make"],
      order: [["make", "ASC"]],
    });

    return res.json(rows.map((r) => r.make));
  } catch (error) {
    console.error("Error getCarMakes:", error);
    return res.status(500).json({ message: "Ошибка при получении марок" });
  }
};

// @map: createCarModel (Создать Модель) -> make, model, doors, powertrain, minYearEconom, minYearElectro, minYearComfort, minYearComfortPlus, minYearBusiness, isActive [Admin]
export const createCarModel = async (req, res) => {
  try {
    const {
      make,
      model,
      doors,
      powertrain,
      minYearEconom,
      minYearElectro,
      minYearComfort,
      minYearComfortPlus,
      minYearBusiness,
      isActive,
    } = req.body;

    if (!make || !model) {
      return res.status(400).json({ message: "make и model обязательны" });
    }

    const p = String(powertrain || "").trim();
    if (!["ice", "ev"].includes(p)) {
      return res
        .status(400)
        .json({ message: "powertrain должен быть ice или ev" });
    }

    const doorsNum = Number(doors);
    if (!Number.isFinite(doorsNum) || doorsNum <= 0) {
      return res.status(400).json({ message: "doors должен быть числом > 0" });
    }

    const payload = {
      make: String(make).trim(),
      model: String(model).trim(),
      doors: doorsNum,
      powertrain: p,
      minYearEconom: toIntOrNull(minYearEconom),
      minYearElectro: toIntOrNull(minYearElectro),
      minYearComfort: toIntOrNull(minYearComfort),
      minYearComfortPlus: toIntOrNull(minYearComfortPlus),
      minYearBusiness: toIntOrNull(minYearBusiness),
    };

    if (isActive !== undefined) payload.isActive = Boolean(isActive);

    const created = await CarModel.create(payload);
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error createCarModel:", error);

    if (error?.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ message: "Такая пара make+model уже существует" });
    }

    return res.status(500).json({ message: "Ошибка создания модели" });
  }
};

const TARIFF_FIELD_MAP = {
  econom: "minYearEconom",
  comfort: "minYearComfort",
  comfortPlus: "minYearComfortPlus",
  business: "minYearBusiness",
  electro: "minYearElectro",
};

// @map: bulkUpsertCarModelsByTariff (Массовый Импорт) -> make, model, powertrain, minYearEconom, minYearElectro, minYearComfort, minYearComfortPlus, minYearBusiness [Admin]
export const bulkUpsertCarModelsByTariff = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { tariff, autos } = req.body;

    if (!TARIFF_FIELD_MAP[tariff]) {
      await t.rollback();
      return res.status(400).json({ message: "Неверный tariff" });
    }

    if (!Array.isArray(autos) || autos.length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "autos должен быть непустым массивом" });
    }

    const tariffField = TARIFF_FIELD_MAP[tariff];

    const normalized = autos.map((a, idx) => {
      if (!a.make || !a.model || !a.fromYear) {
        throw new Error(`INVALID_ITEM_${idx}`);
      }
      if (!["ice", "ev"].includes(a.powertrain)) {
        throw new Error(`INVALID_POWERTRAIN_${idx}`);
      }

      return {
        make: String(a.make).trim(),
        model: String(a.model).trim(),
        fromYear: Number(a.fromYear),
        powertrain: a.powertrain,
      };
    });

    const pairs = normalized.map((x) => ({
      make: x.make,
      model: x.model,
    }));

    const existing = await CarModel.findAll({
      where: { [Op.or]: pairs },
      transaction: t,
    });

    const existingMap = new Map(
      existing.map((m) => [`${m.make}__${m.model}`, m])
    );

    let created = 0;
    let updated = 0;

    for (const item of normalized) {
      const key = `${item.make}__${item.model}`;
      const found = existingMap.get(key);

      if (!found) {
        await CarModel.create(
          {
            make: item.make,
            model: item.model,
            doors: 4,
            powertrain: item.powertrain,
            [tariffField]: item.fromYear,
          },
          { transaction: t }
        );
        created++;
        continue;
      }

      // --- update ---
      found[tariffField] = item.fromYear;

      // powertrain: ev имеет приоритет
      if (found.powertrain === "ice" && item.powertrain === "ev") {
        found.powertrain = "ev";
      }

      await found.save({ transaction: t });
      updated++;
    }

    await t.commit();
    return res.json({
      tariff,
      created,
      updated,
      total: created + updated,
    });
  } catch (error) {
    await t.rollback();
    console.error("bulkUpsertCarModelsByTariff error:", error);

    if (String(error.message).startsWith("INVALID_")) {
      return res.status(400).json({
        message: "Некорректные данные в autos",
        code: error.message,
      });
    }

    return res.status(500).json({ message: "Ошибка массового импорта" });
  }
};

// @map: updateCarModel (Обновить Модель) -> make, model, doors, powertrain, minYearEconom, minYearElectro, minYearComfort, minYearComfortPlus, minYearBusiness, isActive [Admin]
export const updateCarModel = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await CarModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Модель не найдена" });

    let patch;
    try {
      patch = pickUpdateFields(req.body);
    } catch (e) {
      if (e.message === "INVALID_POWERTRAIN") {
        return res
          .status(400)
          .json({ message: "powertrain должен быть ice или ev" });
      }
      throw e;
    }

    // если ничего не пришло
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: "Нет полей для обновления" });
    }

    Object.assign(row, patch);
    await row.save();

    return res.json(row);
  } catch (error) {
    console.error("Error updateCarModel:", error);

    if (error?.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ message: "Такая пара make+model уже существует" });
    }

    return res.status(500).json({ message: "Ошибка обновления модели" });
  }
};

// @map: blockCarModel (Блокировка) -> isActive [Admin]
export const blockCarModel = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await CarModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Модель не найдена" });

    row.isActive = false;
    await row.save();

    return res.json({ id: row.id, isActive: row.isActive });
  } catch (error) {
    console.error("Error blockCarModel:", error);
    return res.status(500).json({ message: "Ошибка блокировки модели" });
  }
};

// @map: unblockCarModel (Разблокировка) -> isActive [Admin]
export const unblockCarModel = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await CarModel.findByPk(id);
    if (!row) return res.status(404).json({ message: "Модель не найдена" });

    row.isActive = true;
    await row.save();

    return res.json({ id: row.id, isActive: row.isActive });
  } catch (error) {
    console.error("Error unblockCarModel:", error);
    return res.status(500).json({ message: "Ошибка разблокировки модели" });
  }
};
