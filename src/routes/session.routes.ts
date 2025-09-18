import { Router } from "express";
import { registerDevice } from "../controllers/session.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/register", authMiddleware, registerDevice);

export default router;
