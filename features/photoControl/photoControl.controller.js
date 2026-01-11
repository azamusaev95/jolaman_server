// controllers/control.controller.js

import { Op } from "sequelize";
// ИЗМЕНЕНО: Импорт моделей из единого файла моделей
import { PhotoControl, SelfieControl } from "./photoControl.model.js";

/**
 * ЕДИНЫЙ ЗАПРОС ПРОВЕРКИ
 * @map: checkAllControls
 * Проверяет сразу и фотоконтроль авто (15 дней), и селфи (5 дней)
 */
export const checkAllControls = async (req, res) => {
  try {
    const { driverId, vehicleId } = req.query;

    if (!driverId || !vehicleId) {
      return res.status(400).json({
        success: false,
        error: "Нужно передать driverId и vehicleId",
      });
    }

    const PHOTO_WINDOW = 15;
    const SELFIE_WINDOW = 5;
    const now = new Date();

    const photoFromDate = new Date(
      now.getTime() - PHOTO_WINDOW * 24 * 60 * 60 * 1000
    );
    const selfieFromDate = new Date(
      now.getTime() - SELFIE_WINDOW * 24 * 60 * 60 * 1000
    );

    // ИЗМЕНЕНО: Используем Promise.all для параллельного выполнения двух запросов к БД
    const [lastPhoto, lastSelfie] = await Promise.all([
      PhotoControl.findOne({
        where: {
          driverId,
          vehicleId,
          status: "approved",
          date: { [Op.gte]: photoFromDate },
        },
        order: [["date", "DESC"]],
      }),
      SelfieControl.findOne({
        where: {
          driverId,
          status: "approved",
          date: { [Op.gte]: selfieFromDate },
        },
        order: [["date", "DESC"]],
      }),
    ]);

    // ИЗМЕНЕНО: Формируем общий ответ по обоим видам контроля
    return res.json({
      success: true,
      photoControl: {
        isPassed: !!lastPhoto,
        daysWindow: PHOTO_WINDOW,
        lastControl: lastPhoto,
      },
      selfieControl: {
        isPassed: !!lastSelfie,
        daysWindow: SELFIE_WINDOW,
        lastControl: lastSelfie,
      },
      // Общий флаг: может ли водитель работать
      canWork: !!lastPhoto && !!lastSelfie,
    });
  } catch (e) {
    console.error("Ошибка при комплексной проверке контроля:", e);
    return res.status(500).json({
      success: false,
      error: "Ошибка сервера при проверке статусов контроля",
    });
  }
};

// --- СЕКЦИЯ ФОТОКОНТРОЛЯ АВТО ---

// @map: createPhotoControl
export const createPhotoControl = async (req, res) => {
  try {
    const { driverId, vehicleId, photos } = req.body;

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
    return res.status(400).json({
      success: false,
      error: e.message || "Ошибка при сохранении фотоконтроля",
    });
  }
};

// @map: getPhotoControls (Список для админки)
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
    if (driverId) where.driverId = driverId;
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date[Op.gte] = new Date(fromDate);
      if (toDate) where.date[Op.lte] = new Date(toDate);
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
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: getPhotoControlById
export const getPhotoControlById = async (req, res) => {
  try {
    const { id } = req.params;
    const photoControl = await PhotoControl.findByPk(id);

    if (!photoControl) {
      return res.status(404).json({ error: "Фотоконтроль не найден" });
    }

    return res.json({ success: true, photoControl });
  } catch (e) {
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: updatePhotoControlStatus
export const updatePhotoControlStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Неверный статус" });
    }

    if (
      status === "rejected" &&
      (!rejectionReason || rejectionReason.trim() === "")
    ) {
      return res.status(400).json({ error: "При отклонении укажите причину" });
    }

    const photoControl = await PhotoControl.findByPk(id);
    if (!photoControl) return res.status(404).json({ error: "Не найден" });

    photoControl.status = status;
    photoControl.rejectionReason =
      status === "approved" ? null : rejectionReason;

    await photoControl.save();
    return res.json({ success: true, photoControl });
  } catch (e) {
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};

// --- СЕКЦИЯ СЕЛФИ-КОНТРОЛЯ ---

// @map: createSelfieControl
export const createSelfieControl = async (req, res) => {
  try {
    const { driverId, photo } = req.body;

    if (!driverId || !photo) {
      return res.status(400).json({
        success: false,
        error: "Необходимо передать driverId и ссылку на photo",
      });
    }

    const newSelfie = await SelfieControl.create({
      driverId,
      photo,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      selfieControl: newSelfie,
    });
  } catch (e) {
    console.error("Ошибка при создании селфи-контроля:", e);
    return res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};

// @map: updateSelfieStatus
export const updateSelfieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({ error: "Укажите причину отказа" });
    }

    const selfie = await SelfieControl.findByPk(id);
    if (!selfie) return res.status(404).json({ error: "Запись не найдена" });

    selfie.status = status;
    selfie.rejectionReason = status === "rejected" ? rejectionReason : null;
    await selfie.save();

    return res.json({ success: true, selfie });
  } catch (e) {
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: getSelfieControls
export const getSelfieControls = async (req, res) => {
  try {
    const { driverId, status, page = 1, limit = 10 } = req.query;
    const where = {};
    if (driverId) where.driverId = driverId;
    if (status) where.status = status;

    const { rows, count } = await SelfieControl.findAndCountAll({
      where,
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [["date", "DESC"]],
    });

    return res.json({ success: true, rows, count });
  } catch (e) {
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};
