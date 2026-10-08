import { Router } from "express";
import {
  createChart,
  getSavedCharts,
  getChartById,
  deleteChartById,
  askChartQuestion,
} from "../controllers/chartController.js";

const router = Router();

// POST /api/chart/ask - Generate ChatGPT AI astrological answer to querent question
router.post("/ask", askChartQuestion);

// POST /api/chart - Calculate chart (and persist to MongoDB if connected)
router.post("/", createChart);

// GET /api/chart - Retrieve saved charts (optional ?email=query)
router.get("/", getSavedCharts);

// GET /api/chart/:id - Retrieve specific saved chart
router.get("/:id", getChartById);

// DELETE /api/chart/:id - Delete specific saved chart
router.delete("/:id", deleteChartById);

export default router;
