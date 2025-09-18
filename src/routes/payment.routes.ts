import { Router } from "express";
import fileUpload from "express-fileupload";
import { createTransaction, uploadReceipt, completeTransaction } from "../controllers/payment.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(fileUpload({ useTempFiles: true }));

// Buyer creates a transaction
router.post("/", authMiddleware, createTransaction);

// Buyer/Seller uploads receipt
router.post("/receipt", authMiddleware, uploadReceipt);

// Buyer or Seller marks transaction complete
router.post("/complete", authMiddleware, completeTransaction);

export default router;
