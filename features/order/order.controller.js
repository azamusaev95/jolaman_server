import sequelize from "../../config/db.js";
import Order from "./order.model.js";
import OrderRoutePoint from "../orderRoutePoint/orderRoutePoint.model.js";
import Tariff from "../tariff/tariff.model.js";
import Driver from "../driver/driver.model.js";
import Client from "../client/client.model.js";
import { Op } from "sequelize";

// Вспомогательная функция (не метод API)
const calculatePrice = (tariff, distanceKm, durationMin) => {
  let price = Number(tariff.basePrice);
  if (distanceKm) price += distanceKm * Number(tariff.pricePerKm);
  if (durationMin) price += durationMin * Number(tariff.pricePerMinute);
  return Math.max(price, Number(tariff.basePrice)).toFixed(2);
};

// @map: createOrder (Создать Заказ) -> clientId, tariffId, fromAddress, toAddress, estimatedPrice, status, scheduledAt, routePoints [Client, Dispatcher]
export const createOrder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      clientId,
      tariffId,
      fromAddress,
      fromLat,
      fromLng,
      toAddress,
      toLat,
      toLng,
      routePoints,
      paymentMethod,
      comment,
      scheduledAt,
    } = req.body;

    const tariff = await Tariff.findByPk(tariffId);
    if (!tariff) {
      await t.rollback();
      return res.status(404).json({ error: "Тариф не найден" });
    }

    const mockDistance = 5;
    const estimatedPrice = calculatePrice(tariff, mockDistance, 10);

    const finalClientId = req.user.role === "client" ? req.user.id : clientId;

    const newOrder = await Order.create(
      {
        clientId: finalClientId,
        tariffId,
        dispatcherId:
          req.user.role === "admin" || req.user.role === "dispatcher"
            ? req.user.id
            : null,
        publicNumber: Math.floor(1000 + Math.random() * 9000).toString(),
        status: "new",
        fromAddress,
        fromLat,
        fromLng,
        toAddress,
        toLat,
        toLng,
        estimatedPrice,
        paymentMethod,
        comment,
        scheduledAt,
        routePoints: routePoints || [],
      },
      {
        include: ["routePoints"],
        transaction: t,
      }
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      order: newOrder,
    });
  } catch (e) {
    await t.rollback();
    console.error(e);
    res.status(500).json({ error: "Ошибка при создании заказа" });
  }
};

// @map: acceptOrder (Принять Заказ) -> driverId, status [Driver]
export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const driverId = req.user.id;

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: "Заказ не найден" });

    if (order.status !== "new") {
      return res.status(400).json({ error: "Заказ уже занят или отменен" });
    }

    order.driverId = driverId;
    order.status = "driver_assigned";
    await order.save();

    return res.json({ success: true, order });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: updateOrderStatus (Изменить Статус) -> status, startedAt [Driver]
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ error: "Заказ не найден" });

    if (status === "driver_arrived" && order.status !== "driver_assigned") {
      return res.status(400).json({ error: "Неверный статус" });
    }

    if (status === "in_progress") {
      order.startedAt = new Date();
    }

    order.status = status;
    await order.save();

    return res.json({ success: true, order });
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// @map: finishOrder (Завершить Заказ) -> status, distanceKm, durationMin, finalPrice, finishedAt, isPaid [Driver]
export const finishOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { distanceKm, durationMin } = req.body;

    const order = await Order.findByPk(id, { include: ["tariff"] });
    if (!order) return res.status(404).json({ error: "Заказ не найден" });

    const finalPrice = calculatePrice(order.tariff, distanceKm, durationMin);

    order.status = "completed";
    order.distanceKm = distanceKm;
    order.durationMin = durationMin;
    order.finalPrice = finalPrice;
    order.finishedAt = new Date();

    if (order.paymentMethod === "bonus") {
      order.isPaid = true;
    }

    await order.save();

    return res.json({
      success: true,
      order,
      message: `Поездка завершена. Сумма: ${finalPrice} сом`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка завершения заказа" });
  }
};

// @map: listOrders (История Заказов) -> status, driverId, clientId [Admin, Dispatcher]
export const listOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, driverId, clientId } = req.query;
    const where = {};

    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (clientId) where.clientId = clientId;

    const { rows, count } = await Order.findAndCountAll({
      where,
      limit: +limit,
      offset: (+page - 1) * +limit,
      order: [["createdAt", "DESC"]],
      include: [
        { model: Tariff, as: "tariff", attributes: ["name"] },
        {
          model: Driver,
          as: "driver",
          attributes: ["firstName", "lastName", "phone"],
        },
        { model: Client, as: "client", attributes: ["name", "phone"] },
      ],
      distinct: true,
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
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
};

// @map: getOrderById (Детали Заказа) -> id, status, fromAddress, toAddress [Admin, Driver, Client]
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id, {
      include: [
        { model: OrderRoutePoint, as: "routePoints" },
        { model: Tariff, as: "tariff" },
        { model: Client, as: "client" },
        { model: Driver, as: "driver" },
      ],
      order: [
        [{ model: OrderRoutePoint, as: "routePoints" }, "sequence", "ASC"],
      ],
    });

    if (!order) return res.status(404).json({ error: "Заказ не найден" });

    return res.json({ success: true, order });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};
