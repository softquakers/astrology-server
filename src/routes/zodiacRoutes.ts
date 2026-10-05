import { Router } from "express";
import {
  getAllSigns,
  getSignByName,
  getHoroscope,
} from "../controllers/zodiacController.js";

const router = Router();

// GET /api/zodiac
router.get("/", getAllSigns);

// GET /api/zodiac/:sign
router.get("/:sign", getSignByName);

// GET /api/zodiac/:sign/horoscope
router.get("/:sign/horoscope", getHoroscope);

export default router;
