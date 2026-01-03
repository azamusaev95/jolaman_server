import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const DriverApplication = sequelize.define(
  "DriverApplication",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Тип работы (добавлено новое поле)
    workType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "taxi",
      field: "work_type",
      validate: {
        isIn: {
          args: [
            [
              "taxi",
              "courier_foot", // пеший
              "courier_bike", // вело
              "courier_moto", // мопед (права/техпаспорт не требуем по вашему условию)
              "courier_auto", // авто-курьер
              "truck", // грузовой
            ],
          ],
          msg: "Недопустимый тип работы",
        },
      },
    },

    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
      allowNull: false,
    },

    reviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "review_comment",
    },

    // --- Документы ---

    // Паспорт и селфи обязательны для ВСЕХ (для идентификации личности)
    passportFront: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "passport_front",
    },

    passportBack: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "passport_back",
    },

    selfieWithPassport: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "selfie_with_passport",
    },

    // Техпаспорт: Необязателен в БД, но обязателен кодом для авто
    carTechPassport: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "car_tech_passport",
    },

    // Права (лицо): Необязательны в БД, но обязательны кодом для авто
    driverLicenseFront: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "driver_license_front",
    },

    // Права (задняя): Необязательны в БД, но обязательны кодом для авто
    driverLicenseBack: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "driver_license_back",
    },
  },
  {
    tableName: "driver_applications",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["status"],
      },
      {
        fields: ["phone"],
      },
    ],
    // ВАЛИДАЦИЯ ЗАВИСИМОСТЕЙ
    validate: {
      checkVehicleDocuments() {
        // Список типов, для которых документы на авто ОБЯЗАТЕЛЬНЫ
        const typesRequiringAutoDocs = ["taxi", "courier_auto", "truck"];

        // Если выбранный тип требует авто-документов
        if (typesRequiringAutoDocs.includes(this.workType)) {
          if (!this.carTechPassport) {
            throw new Error("Техпаспорт обязателен для данного типа работы");
          }
          if (!this.driverLicenseFront) {
            throw new Error("Водительские права (лицевая сторона) обязательны");
          }
          if (!this.driverLicenseBack) {
            throw new Error(
              "Водительские права (обратная сторона) обязательны"
            );
          }
        }
        // Для courier_foot, courier_bike, courier_moto документы не проверяем
      },
    },
  }
);

export default DriverApplication;
