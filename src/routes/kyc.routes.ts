import { Router } from "express";
import fileUpload from "express-fileupload";
import { uploadKycDocument, verifyKyc } from "../controllers/kyc.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(fileUpload({ useTempFiles: true }));

// User uploads KYC doc
router.post("/upload", authMiddleware, uploadKycDocument);

// Admin verifies/rejects
router.post("/verify", authMiddleware, verifyKyc);

export default router;
