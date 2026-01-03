import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import Driver from "../driver/driver.model.js";
import Order from "../order/order.model.js";
import DriverTransaction from "./transaction.model.js";

const OPERATION_TYPES = {
  deposit: true,
  bonus: true,
  order_commission: false,
  withdrawal: false,
  penalty: false,
  subscription: false,
};

// @map: changeDriverBalance (Изменить Баланс) -> driverId, amount, type, description, balanceAfter, balance [Admin/System]
export const changeDriverBalance = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { driverId, amount, type, description, orderId } = req.body;

    if (!driverId || !amount || !type) {
      throw new Error("Не указаны обязательные поля (driverId, amount, type)");
    }
    if (amount <= 0) {
      throw new Error("Сумма должна быть больше нуля");
    }
    if (OPERATION_TYPES[type] === undefined) {
      throw new Error("Неверный тип операции");
    }

    // Блокировка водителя для атомарного обновления
    const driver = await Driver.findByPk(driverId, {
      transaction: t,
      lock: true,
    });

    if (!driver) {
      throw new Error("Водитель не найден");
    }

    const currentBalance = Number(driver.balance);
    const operationAmount = Number(amount);
    let newBalance = 0;
    const isPositiveOperation = OPERATION_TYPES[type];

    if (isPositiveOperation) {
      newBalance = currentBalance + operationAmount;
    } else {
      newBalance = currentBalance - operationAmount;
    }

    newBalance = Number(newBalance.toFixed(2));

    // Обновление баланса водителя
    driver.balance = newBalance;
    await driver.save({ transaction: t });

    // Создание записи транзакции
    const transactionRecord = await DriverTransaction.create(
      {
        driverId,
        orderId: orderId || null,
        amount: operationAmount,
        type,
        description,
        balanceAfter: newBalance,
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      message: isPositiveOperation ? "Баланс пополнен" : "Средства списаны",
      data: {
        transactionId: transactionRecord.id,
        previousBalance: currentBalance,
        newBalance: newBalance,
        operation: type,
        amount: operationAmount,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Ошибка транзакции:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Ошибка обработки транзакции",
    });
  }
};

// @map: getDriverHistory (История Водителя) -> driverId, amount, type, description, balanceAfter [Admin/Driver]
export const getDriverHistory = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const history = await DriverTransaction.findAndCountAll({
      where: { driverId },
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      total: history.count,
      pages: Math.ceil(history.count / limit),
      data: history.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// @map: getAllTransactions (Все Транзакции) -> driverId, type, amount, description, balanceAfter [Admin]
export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      driverId,
      startDate,
      endDate,
      search,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (type) where.type = type;
    if (driverId) where.driverId = driverId;

    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = {
        [Op.between]: [new Date(startDate), end],
      };
    }

    if (search) {
      where.description = {
        [Op.iLike]: `%${search}%`,
      };
    }

    const { count, rows } = await DriverTransaction.findAndCountAll({
      where,
      limit: Number(limit),
      offset: Number(offset),
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Driver,
          as: "driver",
          attributes: ["id", "firstName", "lastName", "phone", "licenseNumber"],
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "publicNumber"],
        },
      ],
    });

    return res.json({
      success: true,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: Number(page),
      data: rows,
    });
  } catch (e) {
    console.error("Ошибка при получении всех транзакций:", e);
    res.status(500).json({ message: "Ошибка загрузки списка транзакций" });
  }
};
