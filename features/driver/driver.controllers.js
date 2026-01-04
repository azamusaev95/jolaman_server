import Driver from "./driver.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Vehicle from "../vehicle/vehicle.model.js";

const STRICT_LICENSE_ROLES = ["taxi", "courier_auto", "truck"];

export const createDriver = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      middleName,
      phone,
      password,
      workType,
      pin,
      passportSeries,
      passportNumber,
      licenseNumber,
      licenseIssueDate,
      licenseExpiryDate,
      experienceStartDate,
      ...rest
    } = req.body;

    const missingFields = [];
    if (!firstName) missingFields.push("Имя");
    if (!lastName) missingFields.push("Фамилия");
    if (!phone) missingFields.push("Телефон");
    if (!password) missingFields.push("Пароль");
    if (!workType) missingFields.push("Тип работы");
    if (!pin) missingFields.push("ПИН");
    if (!passportNumber) missingFields.push("Номер паспорта");

    if (missingFields.length)
      return res
        .status(400)
        .json({ message: `Не заполнены: ${missingFields.join(", ")}` });

    if (STRICT_LICENSE_ROLES.includes(workType)) {
      const errs = [];
      if (!licenseNumber) errs.push("Номер ВУ");
      if (!licenseIssueDate) errs.push("Дата выдачи");
      if (!licenseExpiryDate) errs.push("Срок действия");
      if (!experienceStartDate) errs.push("Начало стажа");

      if (errs.length)
        return res
          .status(400)
          .json({ message: `Для ${workType} нужны права: ${errs.join(", ")}` });
    }

    const where = [{ phone }, { pin }, { passportNumber }];
    if (licenseNumber) where.push({ licenseNumber });

    const existing = await Driver.findOne({ where: { [Op.or]: where } });

    if (existing) {
      if (existing.phone === phone)
        return res.status(400).json({ message: "Телефон занят" });
      if (existing.pin === pin)
        return res.status(400).json({ message: "ПИН занят" });
      if (existing.passportNumber === passportNumber)
        return res.status(400).json({ message: "Паспорт занят" });
      if (licenseNumber && existing.licenseNumber === licenseNumber)
        return res.status(400).json({ message: "ВУ уже существует" });
      return res.status(400).json({ message: "Данные уже используются" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const driver = await Driver.create({
      firstName,
      lastName,
      middleName,
      phone,
      passwordHash,
      workType,
      pin,
      passportNumber,
      licenseNumber,
      licenseIssueDate,
      licenseExpiryDate,
      experienceStartDate,
      balance: 0,
      rating: 5.0,
      status: "pending",
      ...rest,
    });

    const { passwordHash: _, ...data } = driver.toJSON();
    return res.status(201).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
};

const normalizePhone = (value) => {
  if (!value) return value;
  // Оставляем только цифры и плюс: " +996 550 000 002 " -> "+996550000002"
  return value.replace(/[^\d+]/g, "");
};

export const loginDriver = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Телефон и пароль обязательны" });
    }

    const normalizedPhone = normalizePhone(phone);

    const phoneVariants = [normalizedPhone, `+${normalizedPhone}`];

    console.log("[LOGIN_DRIVER] login_attempt", {
      phoneRaw: phone,
      phoneNormalized: normalizedPhone,
      phoneVariants,
    });

    const driver = await Driver.findOne({
      where: {
        phone: phoneVariants,
      },
    });

    if (!driver) {
      console.log("[LOGIN_DRIVER] driver_not_found", {
        phoneRaw: phone,
        phoneNormalized: normalizedPhone,
      });
      return res.status(401).json({ message: "Неверные данные" });
    }

    const ok = await bcrypt.compare(password, driver.passwordHash);

    if (!ok) {
      console.log("[LOGIN_DRIVER] wrong_password", {
        driverId: driver.id,
      });
      return res.status(401).json({ message: "Неверные данные" });
    }

    if (["blocked", "pending"].includes(driver.status)) {
      console.log("[LOGIN_DRIVER] access_denied", {
        driverId: driver.id,
        status: driver.status,
      });
      return res.status(403).json({ message: "Доступ запрещён" });
    }

    // 👉 токен только с id (без role)
    const token = jwt.sign({ id: driver.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    const { passwordHash, ...data } = driver.toJSON();

    console.log("[LOGIN_DRIVER] success", {
      driverId: driver.id,
    });

    return res.json({
      token,
      driver: data,
    });
  } catch (e) {
    console.error("[LOGIN_DRIVER] error", e);
    return res.status(500).json({ message: "Ошибка входа" });
  }
};
export const getDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, q, status, workType, isOnline } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (workType) where.workType = workType;
    if (isOnline !== undefined) where.isOnline = isOnline === "true";

    if (q) {
      const s = `%${q}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: s } },
        { lastName: { [Op.iLike]: s } },
        { phone: { [Op.iLike]: s } },
        { pin: { [Op.iLike]: s } },
      ];
    }

    const { count, rows } = await Driver.findAndCountAll({
      where,
      limit: +limit,
      offset: +offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["passwordHash"] },
    });

    return res.json({
      items: rows,
      meta: {
        total: count,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Ошибка списка" });
  }
};

export const getDriverById = async (req, res) => {
  const driver = await Driver.findByPk(req.params.id, {
    attributes: { exclude: ["passwordHash"] },
  });
  if (!driver) return res.status(404).json({ message: "Не найден" });
  res.json(driver);
};

export const updateDriver = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.passwordHash;
  delete updates.balance;
  delete updates.rating;

  const driver = await Driver.findByPk(id);
  if (!driver) return res.status(404).json({ message: "Не найден" });

  await driver.update(updates);
  const data = driver.toJSON();
  delete data.passwordHash;
  res.json(data);
};

export const changeDriverStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["active", "blocked", "pending", "on_shift"];

  if (!allowed.includes(status))
    return res.status(400).json({ message: "Недопустимый статус" });

  const driver = await Driver.findByPk(id);
  if (!driver) return res.status(404).json({ message: "Не найден" });

  driver.status = status;
  await driver.save();

  res.json({ id: driver.id, status });
};

export const changeDriverWorkType = async (req, res) => {
  const { id } = req.params;
  const { workType } = req.body;
  const allowed = [
    "taxi",
    "courier_foot",
    "courier_bike",
    "courier_moto",
    "courier_auto",
    "truck",
  ];

  if (!allowed.includes(workType))
    return res.status(400).json({ message: "Недопустимый тип" });

  const driver = await Driver.findByPk(id);
  if (!driver) return res.status(404).json({ message: "Не найден" });

  driver.workType = workType;
  await driver.save();

  res.json({ id: driver.id, workType });
};

export const deleteDriver = async (req, res) => {
  const driver = await Driver.findByPk(req.params.id);
  if (!driver) return res.status(404).json({ message: "Не найден" });

  await driver.destroy();
  res.json({ message: "Удалён" });
};

export const getDriverProfile = async (req, res) => {
  try {
    // 👉 ID всегда только из токена, который распаковал authDriver
    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const driver = await Driver.findByPk(driverId, {
      attributes: [
        "id",
        "firstName",
        "lastName",
        "middleName",
        "phone",
        "status",
        "isOnline",
        "workType",
        "rating",
        "balance",
        "level",
        "priorityScore",
        "vehicleId",
        "photo",
      ],
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "type",
            "brand",
            "model",
            "color",
            "licensePlate",
            "status",
          ],
        },
      ],
    });

    if (!driver) {
      return res.status(404).json({ message: "Водитель не найден" });
    }

    const fullName = [driver.lastName, driver.firstName, driver.middleName]
      .filter(Boolean)
      .join(" ");

    return res.json({
      id: driver.id,
      fullName,
      phone: driver.phone,

      status: driver.status,
      isOnline: driver.isOnline,
      workType: driver.workType,

      rating: driver.rating,
      balance: driver.balance,
      level: driver.level,
      priorityScore: driver.priorityScore,
      photo: driver.photo || null,
      vehicle: driver.vehicle || null,
    });
  } catch (e) {
    console.error("❌ getDriverProfile error:", e);
    return res
      .status(500)
      .json({ message: "Ошибка получения профиля водителя" });
  }
};
