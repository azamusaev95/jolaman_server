// controllers/photoControl.controller.js

import { Op } from "sequelize";
import PhotoControl from "./photoControl.model.js";

// @map: createPhotoControl (Создание новой записи фотоконтроля водителем)
export const createPhotoControl = async (req, res) => {
  try {
    const { driverId, vehicleId, photos } = req.body;

    // Простая проверка на наличие обязательных полей перед попыткой сохранения
    if (!driverId || !vehicleId || !photos) {
      return res.status(400).json({
        success: false,
        error: "Необходимо передать driverId, vehicleId и объект photos",
      });
    }

    const newControl = await PhotoControl.create({
      driverId,
      vehicleId,
      photos,
      date: new Date(),
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      photoControl: newControl,
    });
  } catch (e) {
    console.error("Ошибка при создании фотоконтроля:", e);
    // Sequelize вернет ошибку валидации, если в photos не хватает ракурсов
    return res.status(400).json({
      success: false,
      error: e.message || "Ошибка при сохранении фотоконтроля",
    });
  }
};

// @map: getPhotoControls (Список фотоконтролей с фильтрами)
export const getPhotoControls = async (req, res) => {
  try {
    const {
      driverId,
      vehicleId,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = req.query;

    const where = {};

    if (driverId) {
      where.driverId = driverId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date[Op.gte] = new Date(fromDate);
      }
      if (toDate) {
        where.date[Op.lte] = new Date(toDate);
      }
    }

    const { rows, count } = await PhotoControl.findAndCountAll({
      where,
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [["date", "DESC"]],
    });

    return res.json({
      success: true,
      rows,
      count,
    });
  } catch (e) {
    console.error("Ошибка получения фотоконтролей:", e);
    return res
      .status(500)
      .json({ error: "Ошибка сервера при загрузке фотоконтролей" });
  }
};

// @map: checkPhotoControlForDriverAndVehicle
// Проверка: прошёл ли фотоконтроль за последние 15 дней для driverId + vehicleId
export const checkPhotoControlForDriverAndVehicle = async (req, res) => {
  try {
    const { driverId, vehicleId } = req.query;

    if (!driverId || !vehicleId) {
      return res.status(400).json({
        error: "Нужно передать driverId и vehicleId",
      });
    }

    const DAYS_WINDOW = 15;
    const now = new Date();
    const fromDate = new Date(
      now.getTime() - DAYS_WINDOW * 24 * 60 * 60 * 1000
    );

    const lastControl = await PhotoControl.findOne({
      where: {
        driverId,
        vehicleId,
        status: "approved", // считаем пройденным только одобренный контроль
        date: {
          [Op.gte]: fromDate,
        },
      },
      order: [["date", "DESC"]],
    });

    const isPassed = !!lastControl;

    return res.json({
      success: true,
      isPassed,
      lastControl,
    });
  } catch (e) {
    console.error("Ошибка проверки фотоконтроля для driverId + vehicleId:", e);
    return res.status(500).json({
      error: "Ошибка сервера при проверке фотоконтроля",
    });
  }
};

// @map: getPhotoControlById (Один фотоконтроль по ID)
export const getPhotoControlById = async (req, res) => {
  try {
    const { id } = req.params;

    const photoControl = await PhotoControl.findByPk(id);

    if (!photoControl) {
      return res.status(404).json({ error: "Фотоконтроль не найден" });
    }

    return res.json({
      success: true,
      photoControl,
    });
  } catch (e) {
    console.error("Ошибка получения фотоконтроля по ID:", e);
    return res
      .status(500)
      .json({ error: "Ошибка сервера при загрузке фотоконтроля" });
  }
};

// @map: updatePhotoControlStatus (Обновить статус фотоконтроля диспетчером)
export const updatePhotoControlStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Неверный статус. Допустимые значения: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    // Логическая проверка: если статус rejected, должен быть комментарий
    if (
      status === "rejected" &&
      (!rejectionReason || rejectionReason.trim() === "")
    ) {
      return res.status(400).json({
        error:
          "При отклонении фотоконтроля необходимо указать причину (rejectionReason)",
      });
    }

    const photoControl = await PhotoControl.findByPk(id);

    if (!photoControl) {
      return res.status(404).json({ error: "Фотоконтроль не найден" });
    }

    photoControl.status = status;

    // Если статус approved, очищаем причину отклонения (если была), иначе записываем новую
    if (status === "approved") {
      photoControl.rejectionReason = null;
    } else if (status === "rejected") {
      photoControl.rejectionReason = rejectionReason;
    }

    await photoControl.save();

    return res.json({
      success: true,
      photoControl,
    });
  } catch (e) {
    console.error("Ошибка обновления статуса фотоконтроля:", e);
    return res.status(500).json({
      error: "Ошибка сервера при обновлении статуса фотоконтроля",
    });
  }
};
