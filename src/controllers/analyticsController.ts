import { Request, Response, NextFunction } from "express";
import {
  recordFunnelEvent,
  getFunnelMetrics,
  seedFunnelDemoData,
  FunnelRecordInput,
} from "../services/funnelService.js";
import { FunnelEvent } from "../models/FunnelEvent.js";

/**
 * Handles incoming funnel events posted by client PWA or server processes.
 * POST /api/analytics/funnel
 */
export async function postFunnelEvent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { step, visitorId, sessionId, email, name, metadata } = req.body || {};

    if (!step || !visitorId) {
      res.status(400).json({
        success: false,
        error: "Missing required 'step' or 'visitorId' field",
      });
      return;
    }

    const validSteps = ["launch", "name", "photo", "dob", "tob", "subscribed", "attached"];
    if (!validSteps.includes(step)) {
      res.status(400).json({
        success: false,
        error: `Invalid step '${step}'. Must be one of: ${validSteps.join(", ")}`,
      });
      return;
    }

    const result = await recordFunnelEvent({
      step,
      visitorId,
      sessionId,
      email,
      name,
      metadata,
    });

    res.status(200).json({
      success: true,
      message: `Funnel step '${step}' logged successfully`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns JSON metrics for the onboarding & conversion funnel.
 * GET /api/analytics/funnel
 */
export async function getFunnelData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await getFunnelMetrics();
    res.status(200).json({
      success: true,
      metrics,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Resets funnel events.
 * POST /admin/funnel/reset
 */
export async function postResetFunnel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await FunnelEvent.deleteMany({});
    res.redirect("/admin?alertType=success&alertMsg=Funnel+data+successfully+reset");
  } catch (err) {
    next(err);
  }
}

/**
 * Seeds demo funnel data.
 * POST /admin/funnel/seed
 */
export async function postSeedFunnel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await seedFunnelDemoData();
    res.redirect("/admin?alertType=success&alertMsg=Funnel+demo+data+successfully+seeded");
  } catch (err) {
    next(err);
  }
}
