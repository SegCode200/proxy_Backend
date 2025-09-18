import { Router } from "express";
import fileUpload from "express-fileupload";
import { uploadMedia } from "../controllers/media.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(fileUpload({ useTempFiles: true }));

router.post("/upload", authMiddleware, uploadMedia);

export default router;
