import Tariff from "./tariff.model.js";

// Хелпер для проверки прав
const canManageTariffs = (user) => {
  return user && (user.role === "superadmin" || user.role === "admin");
};

// @map: createTariff (Создать Тариф) -> name, category, basePrice, pricePerKm, pricePerMinute, waitingPrice, isActive [Admin, Superadmin]
export const createTariff = async (req, res) => {
  try {
    if (!canManageTariffs(req.user)) {
      return res.status(403).json({ error: "Нет прав на создание тарифов" });
    }

    const {
      name,
      category,
      basePrice,
      pricePerKm,
      pricePerMinute,
      waitingPrice,
    } = req.body;

    const existing = await Tariff.findOne({ where: { name } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Тариф с таким названием уже существует" });
    }

    const tariff = await Tariff.create({
      name,
      category,
      basePrice,
      pricePerKm,
      pricePerMinute,
      waitingPrice,
      isActive: true,
    });

    return res.json({ success: true, tariff });
  } catch (e) {
    console.error(e);
    if (e.name === "SequelizeValidationError") {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: listTariffs (Список Тарифов) -> category, isActive, name, basePrice [Public, Auth]
export const listTariffs = async (req, res) => {
  try {
    const { category, isActive, page = 1, limit = 20 } = req.query;

    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const { rows, count } = await Tariff.findAndCountAll({
      where,
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [
        ["category", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({ success: true, rows, count, page: +page, limit: +limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: getTariffById (Детали Тарифа) -> id, name, basePrice, pricePerKm [Public, Auth]
export const getTariffById = async (req, res) => {
  try {
    const { id } = req.params;
    const tariff = await Tariff.findByPk(id);

    if (!tariff) return res.status(404).json({ error: "Тариф не найден" });

    return res.json({ success: true, tariff });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: updateTariff (Обновить Тариф) -> basePrice, pricePerKm, pricePerMinute, waitingPrice, isActive [Admin, Superadmin]
export const updateTariff = async (req, res) => {
  try {
    if (!canManageTariffs(req.user)) {
      return res.status(403).json({ error: "Нет прав на изменение тарифов" });
    }

    const { id } = req.params;
    const {
      basePrice,
      pricePerKm,
      pricePerMinute,
      waitingPrice,
      isActive,
      category,
    } = req.body;

    const tariff = await Tariff.findByPk(id);
    if (!tariff) return res.status(404).json({ error: "Тариф не найден" });

    if (basePrice !== undefined) tariff.basePrice = basePrice;
    if (pricePerKm !== undefined) tariff.pricePerKm = pricePerKm;
    if (pricePerMinute !== undefined) tariff.pricePerMinute = pricePerMinute;
    if (waitingPrice !== undefined) tariff.waitingPrice = waitingPrice;
    if (category !== undefined) tariff.category = category;
    if (isActive !== undefined)
      tariff.isActive = isActive === "true" || isActive === true;

    await tariff.save();

    return res.json({ success: true, tariff });
  } catch (e) {
    console.error(e);
    if (e.name === "SequelizeValidationError") {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: deleteTariff (Архивировать Тариф) -> isActive [Admin, Superadmin]
export const deleteTariff = async (req, res) => {
  try {
    if (!canManageTariffs(req.user)) {
      return res.status(403).json({ error: "Нет прав на удаление тарифов" });
    }

    const tariff = await Tariff.findByPk(req.params.id);
    if (!tariff) return res.status(404).json({ error: "Тариф не найден" });

    tariff.isActive = false;
    await tariff.save();

    return res.json({ success: true, message: "Тариф деактивирован" });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};
