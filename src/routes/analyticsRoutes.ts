import { Router } from "express";
import { postFunnelEvent, getFunnelData } from "../controllers/analyticsController.js";

const router = Router();

// POST /api/analytics/funnel - Track a funnel event
router.post("/funnel", postFunnelEvent);

// GET /api/analytics/funnel - Get funnel conversion statistics
router.get("/funnel", getFunnelData);

// Aliases for convenience
router.post("/event", postFunnelEvent);
router.post("/", postFunnelEvent);

export default router;
