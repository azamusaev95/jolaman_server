import { Router } from "express";
import * as driverController from "./driver.controllers.js";

const router = Router();

router.post("/", driverController.createDriver);
router.post("/login", driverController.loginDriver);

router.get("/", driverController.getDrivers);
router.get("/:id", driverController.getDriverById);
router.put("/:id", driverController.updateDriver);
router.delete("/:id", driverController.deleteDriver);

router.patch("/:id/status", driverController.changeDriverStatus);
router.patch("/:id/work-type", driverController.changeDriverWorkType);

export default router;
