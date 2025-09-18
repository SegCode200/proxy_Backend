import { Router } from "express";
import { createReport, getReports, resolveReport } from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

// User creates a report
router.post("/", authMiddleware, createReport);

// Admin views reports
router.get("/", authMiddleware, requireRole(["ADMIN", "MODERATOR"]), getReports);

// Admin resolves report
router.post("/resolve", authMiddleware, requireRole(["ADMIN", "MODERATOR"]), resolveReport);

export default router;
