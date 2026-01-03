// routes/carModels.routes.js
import { Router } from "express";
import * as controller from "./carBrands.controllers.js"; // <-- поправь путь если нужно

const router = Router();

// list + filters + pagination
router.get("/car-models", controller.getCarModels);

// distinct makes list (for dropdowns)
router.get("/car-models/makes", controller.getCarMakes);

// create one
router.post("/car-models", controller.createCarModel);

// bulk create (skip duplicates)
router.post(
  "/car-models/bulk-by-tariff",
  controller.bulkUpsertCarModelsByTariff
);
// update any fields
router.patch("/car-models/:id", controller.updateCarModel);

// block/unblock instead of delete
router.patch("/car-models/:id/block", controller.blockCarModel);
router.patch("/car-models/:id/unblock", controller.unblockCarModel);

export default router;
