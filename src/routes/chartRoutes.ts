import { Router } from "express";
import { createChart } from "../controllers/chartController.js";

const router = Router();

// POST /api/chart
router.post("/", createChart);

export default router;
