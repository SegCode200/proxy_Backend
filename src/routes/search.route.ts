import { Router } from "express";
import { searchByRadius,searchListings } from "../controllers/search.controller";


const router = Router();

router.get("/radius", searchByRadius);
router.get("/", searchListings);

export default router;
