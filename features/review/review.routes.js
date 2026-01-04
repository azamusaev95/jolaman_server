// routes/review.routes.js (или ./review.routes.js — как у тебя принято)

import { Router } from "express";
import {
  createReview,
  getReviewsByTarget,
  deleteReview,
  getMyDriverRatingStats,
} from "./review.controller.js";
import { authDriver } from "../middlwares/authDriver.js";

const router = Router();

// 1. Оставить отзыв
// POST /api/reviews
router.post("/", createReview);

// 2. Получить отзывы по цели (водитель/клиент)
// GET /api/reviews?targetId=...&targetRole=driver&limit=10&page=1
router.get("/", getReviewsByTarget);

// 3. Удалить отзыв (админка)
// DELETE /api/reviews/:id
router.delete("/:id", deleteReview);

router.get("/my-rating/stats", authDriver, getMyDriverRatingStats);

export default router;
