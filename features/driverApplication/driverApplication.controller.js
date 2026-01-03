import fs from "fs";
import mime from "mime-types";
import DriverApplication from "./driverApplication.model.js";
import { uploadFile } from "../s3/s3_helpers.js";

// 1. ОТПРАВИТЬ ЗАЯВКУ (ДЛЯ ВОДИТЕЛЯ)
export const submitDriverApplication = async (req, res) => {
  try {
    if (!req.files) {
      // await runMiddleware(req, res, multerFields); // Если нужно
    }

    // 1. Получаем phone и workType
    const { phone, workType } = req.body;
    const files = req.files || {};

    if (!phone) {
      return res.status(400).json({ error: "Номер телефона обязателен" });
    }

    // 2. Определяем списки документов
    const baseDocs = ["passportFront", "passportBack", "selfieWithPassport"];

    const autoDocs = [
      "carTechPassport",
      "driverLicenseFront",
      "driverLicenseBack",
    ];

    // Типы работ, требующие авто-документов
    const typesRequiringAutoDocs = ["taxi", "courier_auto", "truck"];

    // Если workType не передан, считаем его 'taxi' (как в дефолте модели) или берем из body
    const currentWorkType = workType || "taxi";

    // Собираем список обязательных полей для текущего типа
    let requiredFields = [...baseDocs];

    if (typesRequiringAutoDocs.includes(currentWorkType)) {
      requiredFields = [...requiredFields, ...autoDocs];
    }

    // 3. Проверяем, все ли ОБЯЗАТЕЛЬНЫЕ файлы загружены
    const missingFiles = [];

    for (const field of requiredFields) {
      if (!files[field] || files[field].length === 0) {
        missingFiles.push(field);
      }
    }

    if (missingFiles.length > 0) {
      return res.status(400).json({
        error:
          "Загружены не все обязательные документы для выбранного типа работы",
        missing: missingFiles,
        workType: currentWorkType,
      });
    }

    // 4. Подготовка к загрузке
    // Объединяем все возможные поля, чтобы загрузить всё, что прислал юзер
    // (даже если пеший курьер зачем-то скинул права, мы их сохраним, если они есть)
    const allPossibleFields = [...baseDocs, ...autoDocs];

    const applicationData = {
      phone,
      workType: currentWorkType, // Сохраняем тип работы
      status: "pending",
    };

    const uploadTasks = [];

    for (const field of allPossibleFields) {
      const fileArray = files[field];

      // Обрабатываем файл только если он есть в req.files
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];

        const task = async () => {
          try {
            const contentType =
              mime.lookup(file.originalname) || "application/octet-stream";

            const safePhone = phone.replace(/\D/g, "");

            const uniqueName = `apps/${safePhone}_${field}_${Date.now()}.${mime.extension(
              contentType
            )}`;

            const s3Url = await uploadFile(file.path, uniqueName, contentType);

            // Удаляем локальный файл
            fs.unlink(file.path, (err) => {
              if (err) console.error(err);
            });

            return { field, url: s3Url };
          } catch (err) {
            console.error(`Ошибка загрузки ${field}:`, err);
            // Пытаемся удалить файл даже при ошибке
            fs.unlink(file.path, () => {});
            throw err;
          }
        };

        uploadTasks.push(task());
      }
    }

    // 5. Выполняем загрузку
    const results = await Promise.all(uploadTasks);

    results.forEach((resItem) => {
      applicationData[resItem.field] = resItem.url;
    });

    // 6. Создаем запись в БД
    const newApp = await DriverApplication.create(applicationData);

    res.status(201).json({ message: "Заявка отправлена", id: newApp.id });
  } catch (error) {
    console.error("Ошибка в submitDriverApplication:", error);
    // Обработка ошибок валидации Sequelize (на всякий случай)
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// 2. ПОЛУЧИТЬ ВСЕ ЗАЯВКИ (ДЛЯ ДИСПЕТЧЕРА)
export const getAllApplications = async (req, res) => {
  try {
    // Фильтры: статус и тип работы
    const { status, workType } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (workType) {
      whereClause.workType = workType;
    }

    const applications = await DriverApplication.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    res.json(applications);
  } catch (error) {
    console.error("Ошибка получения заявок:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// 3. ПОЛУЧИТЬ ОДНУ ЗАЯВКУ ПО ID (ПОДРОБНОСТИ)
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await DriverApplication.findByPk(id);

    if (!application) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }

    res.json(application);
  } catch (error) {
    console.error("Ошибка поиска заявки:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};

// 4. ОБРАБОТАТЬ ЗАЯВКУ (ОДОБРИТЬ / ОТКЛОНИТЬ)
export const processApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Неверный статус. Используйте approved или rejected" });
    }

    const application = await DriverApplication.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }

    application.status = status;
    if (comment) {
      application.reviewComment = comment;
    }
    await application.save();

    if (status === "approved") {
      // Здесь можно добавить логику создания пользователя,
      // используя application.workType для назначения роли или настроек.
    }

    res.json({
      message: status === "approved" ? "Заявка одобрена" : "Заявка отклонена",
      application,
    });
  } catch (error) {
    console.error("Ошибка обработки заявки:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
};
