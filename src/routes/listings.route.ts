import { Router } from "express";
import { createListing, getListingById } from "../controllers/listings.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/", authMiddleware, createListing);
router.get("/:id", getListingById);

export default router;
