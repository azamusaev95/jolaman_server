// controllers/selfieControl.controller.js

import { Op } from "sequelize";
import SelfieControl from "./selfieControl.model.js";

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

// @map: checkSelfieControl (Проверка: пройдено ли селфи за последние 5 дней)
export const checkSelfieControl = async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({ error: "Нужно передать driverId" });
    }

    const DAYS_WINDOW = 5;
    const now = new Date();
    const fromDate = new Date(
      now.getTime() - DAYS_WINDOW * 24 * 60 * 60 * 1000
    );

    const lastSelfie = await SelfieControl.findOne({
      where: {
        driverId,
        status: "approved",
        date: { [Op.gte]: fromDate },
      },
      order: [["date", "DESC"]],
    });

    return res.json({
      success: true,
      isPassed: !!lastSelfie,
      lastSelfie,
    });
  } catch (e) {
    console.error("Ошибка проверки селфи:", e);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: updateSelfieStatus (Для диспетчера)
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

// @map: getSelfieControls (Список для админки)
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
