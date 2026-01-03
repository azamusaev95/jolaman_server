// models/associations.js
import Driver from "./driver.model.js";
import Order from "../";
import Review from "./review.model.js";
// Путь к клиенту (проверь, правильно ли указана папка feature)
import Client from "../feature/client/client.model.js";

export default function initAssociations() {
  // ============================================
  // 1. СВЯЗИ ДЛЯ ВОДИТЕЛЯ
  // ============================================

  // У водителя много отзывов (тех, где targetRole = 'driver')
  Driver.hasMany(Review, {
    foreignKey: "targetId",
    constraints: false, // Отключаем SQL проверку, т.к. поле targetId общее
    scope: { targetRole: "driver" }, // Фильтр: брать только отзывы о водителях
    as: "receivedReviews",
  });

  // Отзыв принадлежит водителю (обратная связь)
  Review.belongsTo(Driver, {
    foreignKey: "targetId",
    constraints: false,
    as: "driver",
  });

  // ============================================
  // 2. СВЯЗИ ДЛЯ КЛИЕНТА
  // ============================================

  // У клиента много отзывов (тех, где targetRole = 'client')
  Client.hasMany(Review, {
    foreignKey: "targetId",
    constraints: false,
    scope: { targetRole: "client" }, // Фильтр: брать только отзывы о клиентах
    as: "receivedReviews",
  });

  // Отзыв принадлежит клиенту
  Review.belongsTo(Client, {
    foreignKey: "targetId",
    constraints: false,
    as: "client",
  });

  // ============================================
  // 3. СВЯЗЬ С ЗАКАЗОМ
  // ============================================

  // У заказа может быть несколько отзывов (от водителя и от клиента)
  Order.hasMany(Review, {
    foreignKey: "orderId",
    as: "reviews",
  });

  Review.belongsTo(Order, {
    foreignKey: "orderId",
    as: "order",
  });

  console.log("✅ Связи моделей (Associations) успешно загружены");
}
