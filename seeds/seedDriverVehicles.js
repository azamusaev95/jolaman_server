// scripts/seedDriverVehicles.js

import sequelize from "../config/db.js";
import Driver from "../features/driver/driver.model.js";
import Vehicle from "../features/vehicle/vehicle.model.js";
import { fakerRU as faker } from "@faker-js/faker";

const seedDriverVehicles = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // 1. Загружаем все машины
    const vehicles = await Vehicle.findAll({
      attributes: ["id", "type", "brand", "model", "licensePlate"],
    });

    if (!vehicles.length) {
      console.log("⚠️ В таблице vehicles нет записей, нечего назначать.");
      process.exit(0);
    }

    const cars = vehicles.filter((v) => v.type === "car" || !v.type);
    const trucks = vehicles.filter((v) => v.type === "truck");

    console.log(
      `🚗 Найдено ТС: всего=${vehicles.length}, cars=${cars.length}, trucks=${trucks.length}`
    );

    // 2. Загружаем всех водителей
    const drivers = await Driver.findAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        "phone",
        "workType",
        "vehicleId",
      ],
    });

    console.log(`👨‍🏭 Найдено водителей: ${drivers.length}`);
    console.log("⚙️ Назначаем vehicles водителям по workType ...");

    let updatedCount = 0;

    for (const driver of drivers) {
      const { workType, phone } = driver;

      // По умолчанию считаем, что у водителя не будет транспорта
      let newVehicleId = null;
      let chosenVehicle = null;

      // workType, которым НУЖНА машина
      if (workType === "taxi" || workType === "courier_auto") {
        if (cars.length > 0) {
          chosenVehicle = faker.helpers.arrayElement(cars);
          newVehicleId = chosenVehicle.id;
        } else {
          console.log(
            `❌ [${phone}] workType=${workType}, но нет доступных car в vehicles`
          );
        }
      } else if (workType === "truck") {
        if (trucks.length > 0) {
          chosenVehicle = faker.helpers.arrayElement(trucks);
          newVehicleId = chosenVehicle.id;
        } else {
          console.log(
            `❌ [${phone}] workType=truck, но нет доступных truck в vehicles`
          );
        }
      } else {
        // courier_foot / courier_bike / courier_moto и др. → без транспорта
        newVehicleId = null;
      }

      // Обновляем только vehicleId
      await driver.update(
        { vehicleId: newVehicleId },
        { fields: ["vehicleId"] }
      );

      if (chosenVehicle) {
        console.log(
          `✔️ [${phone}] ${workType} → ${chosenVehicle.licensePlate} (${chosenVehicle.brand} ${chosenVehicle.model})`
        );
      } else {
        console.log(
          `➖ [${phone}] ${workType} → без транспорта (vehicleId = null)`
        );
      }

      updatedCount++;
    }

    console.log(`🎯 Готово! Обновлено водителей: ${updatedCount}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Ошибка при назначении vehicles водителям:", err);
    process.exit(1);
  }
};

seedDriverVehicles();
