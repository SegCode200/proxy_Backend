import { Router } from "express";
import { createReview, getUserReviews } from "../controllers/review.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Buyer leaves review
router.post("/", authMiddleware, createReview);

// Public fetch reviews for a seller
router.get("/:userId", getUserReviews);

export default router;
