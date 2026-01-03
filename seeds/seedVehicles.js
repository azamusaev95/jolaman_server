import sequelize from "../config/db.js";
import Vehicle from "../features/vehicle/vehicle.model.js"; // 👈 Проверь путь к модели
import { fakerRU as faker } from "@faker-js/faker";

const seedVehicles = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 Подключение к БД успешно.");

    // await sequelize.sync({ force: true }); // Раскомментируй, если хочешь очистить таблицу

    const vehiclesData = [];
    const COUNT = 50; // Сколько машин создать

    console.log(`🚀 Создаем ${COUNT} транспортных средств...`);

    // Списки для реалистичности
    const carModels = [
      { brand: "Toyota", model: "Camry", body: "sedan" },
      { brand: "Toyota", model: "Corolla", body: "sedan" },
      { brand: "Honda", model: "Fit", body: "hatchback" },
      { brand: "Kia", model: "Rio", body: "sedan" },
      { brand: "Hyundai", model: "Solaris", body: "sedan" },
      { brand: "Lexus", model: "RX 350", body: "suv" },
    ];

    const truckModels = [
      { brand: "Hyundai", model: "Porter", body: "tent", capacity: 1500 },
      { brand: "Mercedes", model: "Sprinter", body: "van", capacity: 2500 },
      { brand: "Volvo", model: "FH", body: "refrigerator", capacity: 20000 },
      { brand: "Gaz", model: "Gazelle", body: "flatbed", capacity: 1500 },
    ];

    for (let i = 1; i <= COUNT; i++) {
      // 1. Случайно выбираем тип транспорта (с весами: больше машин, меньше грузовиков)
      const rand = Math.random();
      let type = "car";
      if (rand > 0.7) type = "truck";
      if (rand > 0.9) type = "moto";

      let vehicleInfo = {};
      let specificData = {};

      // 2. Генерируем данные в зависимости от типа
      if (type === "car") {
        const car = faker.helpers.arrayElement(carModels);
        vehicleInfo = { ...car };
        specificData = {
          passengerSeats: 4,
          loadCapacity: null,
          cargoDimensions: null,
          steeringWheel: faker.helpers.arrayElement(["left", "left", "right"]), // В KG много праворульных, но левых больше
          transmission: faker.helpers.arrayElement([
            "auto",
            "manual",
            "variator",
          ]),
        };
      } else if (type === "truck") {
        const truck = faker.helpers.arrayElement(truckModels);
        vehicleInfo = { ...truck };
        specificData = {
          passengerSeats: 2,
          loadCapacity: truck.capacity,
          // Габариты кузова (см)
          cargoDimensions: {
            length: faker.number.int({ min: 300, max: 800 }),
            width: faker.number.int({ min: 200, max: 250 }),
            height: faker.number.int({ min: 180, max: 300 }),
          },
          steeringWheel: "left",
          transmission: "manual",
          options: { hasHydrolift: faker.datatype.boolean() }, // Опция: гидроборт
        };
      } else if (type === "moto") {
        vehicleInfo = { brand: "Honda", model: "Dio", body: "scooter" };
        specificData = {
          passengerSeats: 1,
          steeringWheel: null, // У мото нет руля слева/справа в привычном понимании
          transmission: "variator",
        };
      }

      // 3. Генерируем Гос. Номер (KG формат: 01 123 ABC)
      const region = faker.helpers.arrayElement(["01", "08", "06", "03"]); // Бишкек, Чуй, Ош...
      const numbers = String(faker.number.int({ min: 100, max: 999 }));
      const letters = faker.string.alpha({ length: 3, casing: "upper" });
      const licensePlate = `${region} ${numbers} ${letters}`;

      vehiclesData.push({
        type: type,
        brand: vehicleInfo.brand,
        model: vehicleInfo.model,
        year: faker.number.int({ min: 2000, max: 2024 }),
        color: faker.vehicle.color(),

        licensePlate: licensePlate,
        vin: faker.vehicle.vin(),
        sts: String(faker.number.int({ min: 10000000, max: 99999999 })),

        // Специфичные данные
        bodyType: vehicleInfo.body,
        ...specificData,

        // Статусы
        callSign: `${type.toUpperCase()}-${i}`, // Позывной: CAR-1, TRUCK-5
        status: faker.helpers.arrayElement(["active", "active", "repair"]), // Чаще активные
      });
    }

    // Сохраняем
    await Vehicle.bulkCreate(vehiclesData, {
      validate: true,
      ignoreDuplicates: true,
    });

    console.log(`✅ Успешно создано ${COUNT} авто!`);
    console.log("   Примеры:");
    console.log(
      `   🚗 ${vehiclesData[0].brand} ${vehiclesData[0].model} | ${vehiclesData[0].licensePlate}`
    );
    if (vehiclesData.some((v) => v.type === "truck")) {
      const truck = vehiclesData.find((v) => v.type === "truck");
      console.log(
        `   🚛 ${truck.brand} ${truck.model} | Груз: ${truck.loadCapacity}кг`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при создании транспорта:", error);
    process.exit(1);
  }
};

seedVehicles();
