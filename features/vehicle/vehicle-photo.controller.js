import VehiclePhoto from "./vehicle-photo.model.js";
import Vehicle from "./vehicle.model.js"; // Или проверь путь к модели Vehicle

// @map: createVehiclePhoto (Загрузить фото) -> vehicleId, imageUrl, type, status [Driver]
export const createVehiclePhoto = async (req, res) => {
  try {
    const { vehicleId, imageUrl, type } = req.body;

    // Проверяем, существует ли машина
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: "Транспорт не найден" });
    }

    // Создаем запись фото
    // Статус по умолчанию 'pending'
    const photo = await VehiclePhoto.create({
      vehicleId,
      imageUrl,
      type,
      status: "pending",
    });

    return res.status(201).json(photo);
  } catch (e) {
    console.error("Error uploading photo:", e);
    res.status(500).json({ message: "Ошибка при сохранении фото" });
  }
};

// @map: moderatePhoto (Модерация фото) -> status, rejectionReason [Dispatcher, Admin]
export const moderatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // status: 'approved' | 'rejected'

    const photo = await VehiclePhoto.findByPk(id);
    if (!photo) {
      return res.status(404).json({ message: "Фото не найдено" });
    }

    if (status === "rejected" && !rejectionReason) {
      return res
        .status(400)
        .json({ message: "При отказе нужно указать причину" });
    }

    photo.status = status;
    // Если одобряем, очищаем причину отказа (на всякий случай)
    photo.rejectionReason = status === "approved" ? null : rejectionReason;

    await photo.save();

    return res.json({ success: true, photo });
  } catch (e) {
    console.error("Error moderating photo:", e);
    res.status(500).json({ message: "Ошибка модерации" });
  }
};

// @map: getVehiclePhotos (Получить фото авто) -> imageUrl, type, status, rejectionReason [Driver, Dispatcher]
export const getVehiclePhotos = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const photos = await VehiclePhoto.findAll({
      where: { vehicleId },
      order: [["createdAt", "DESC"]],
    });

    return res.json(photos);
  } catch (e) {
    res.status(500).json({ message: "Ошибка загрузки фото" });
  }
};

// @map: deletePhoto (Удалить фото) -> id [Driver, Admin]
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await VehiclePhoto.findByPk(id);

    if (!photo) return res.status(404).json({ message: "Фото не найдено" });

    await photo.destroy();
    return res.json({ message: "Фото удалено" });
  } catch (e) {
    res.status(500).json({ message: "Ошибка удаления" });
  }
};
