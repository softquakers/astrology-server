import { Router } from "express";
import { getGeoLocation } from "../controllers/geoController.js";

const router = Router();

// GET /api/geo?q=Place
router.get("/", getGeoLocation);

export default router;
