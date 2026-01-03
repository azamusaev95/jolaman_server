import Client from "./client.model.js";
import { Op } from "sequelize";

// @map: createClient (Создать Клиента) -> phone, name, rating, isActive [Admin, Dispatcher]
export const createClient = async (req, res) => {
  try {
    const { phone, name, rating, isActive } = req.body;

    // Проверяем дубликат
    const existing = await Client.findOne({ where: { phone } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Клиент с таким телефоном уже существует" });
    }

    const client = await Client.create({
      phone,
      name,
      rating: rating || 5.0,
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.json({
      success: true,
      client,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка при создании клиента" });
  }
};

// @map: listClients (Список Клиентов) -> phone, name, isActive, rating [Admin, Dispatcher]
export const listClients = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, isActive } = req.query;
    const where = {};

    // Поиск по телефону или имени
    if (q) {
      where[Op.or] = [
        { phone: { [Op.like]: `%${q}%` } },
        { name: { [Op.like]: `%${q}%` } },
      ];
    }

    // Фильтр по статусу
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const { rows, count } = await Client.findAndCountAll({
      where,
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [["createdAt", "DESC"]], // Сначала новые
    });

    return res.json({
      success: true,
      rows,
      count,
      page: +page,
      limit: +limit,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка при загрузке списка клиентов" });
  }
};

// @map: getClientById (Профиль Клиента) -> id, phone, name, rating, bonusBalance, isActive [Admin, Dispatcher]
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id);

    if (!client) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    return res.json({
      success: true,
      client,
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// @map: updateClient (Редактировать Клиента) -> phone, name, rating, bonusBalance, isActive [Admin, Dispatcher]
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, name, rating, bonusBalance, isActive } = req.body;

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    // Если меняют телефон, проверяем, не занят ли он
    if (phone && phone !== client.phone) {
      const existing = await Client.findOne({ where: { phone } });
      if (existing) {
        return res
          .status(400)
          .json({ error: "Этот телефон уже занят другим клиентом" });
      }
      client.phone = phone;
    }

    if (name !== undefined) client.name = name;
    if (rating !== undefined) client.rating = rating;
    if (bonusBalance !== undefined) client.bonusBalance = bonusBalance;
    if (isActive !== undefined)
      client.isActive = isActive === "true" || isActive === true;

    await client.save();

    return res.json({
      success: true,
      client,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка при обновлении клиента" });
  }
};

// @map: deleteClient (Блокировка Клиента) -> isActive [Admin]
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id);

    if (!client) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    // Просто деактивируем, чтобы не потерять историю поездок
    client.isActive = false;
    await client.save();

    return res.json({ success: true, message: "Клиент деактивирован" });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};
