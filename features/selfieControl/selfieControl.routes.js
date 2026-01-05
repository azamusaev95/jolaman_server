// routes/photoControl.routes.js

import { Router } from "express";

import {
  // Контроллеры Селфи-контроля
  getSelfieControls,
  createSelfieControl,
  checkSelfieControl,
  updateSelfieStatus,
} from "./selfieControl.controller.js";

const router = Router();

router.post("/selfie", createSelfieControl);

router.get("/selfie", getSelfieControls);

router.get("/selfie/check", checkSelfieControl);

router.patch("/selfie/:id/status", updateSelfieStatus);

export default router;
