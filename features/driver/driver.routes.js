import { Router } from "express";
import * as driverController from "./driver.controllers.js";
import { authDriver } from "../middlwares/authDriver.js";
import { getDriverProfile } from "./driver.controllers.js";

const router = Router();

router.post("/", driverController.createDriver);
router.post("/login", driverController.loginDriver);
router.get("/me", authDriver, getDriverProfile);

router.get("/", driverController.getDrivers);
router.get("/:id", driverController.getDriverById);
router.put("/:id", driverController.updateDriver);
router.delete("/:id", driverController.deleteDriver);

router.patch("/:id/status", driverController.changeDriverStatus);
router.patch("/:id/work-type", driverController.changeDriverWorkType);

export default router;
