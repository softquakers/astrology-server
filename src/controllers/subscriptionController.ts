import { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import {
  SUBSCRIPTION_PLANS,
  createRazorpaySubscription,
  verifyAndActivateSubscription,
  processRazorpayWebhook,
} from "../services/razorpayService.js";
import { Subscription } from "../models/Subscription.js";
import { recordFunnelEvent } from "../services/funnelService.js";

/**
 * GET /api/subscriptions/plans
 * Returns available membership plans (₹149 monthly, ₹299 3-month) and Razorpay gateway status.
 */
export async function getPlans(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    plans: Object.values(SUBSCRIPTION_PLANS),
    gateway: {
      provider: "razorpay",
      method: "upi_autopay",
      keyId: config.razorpay.keyId,
      isConfigured: config.razorpay.isConfigured,
    },
  });
}

/**
 * POST /api/subscriptions/create
 * Creates a Razorpay UPI AutoPay mandate / subscription.
 */
export async function createSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { planId, email, name, phone, returnUrl } = req.body;

    if (!email || !email.includes("@")) {
      res.status(400).json({
        success: false,
        error: "A valid email address is required to set up a subscription.",
      });
      return;
    }

    if (!planId || !SUBSCRIPTION_PLANS[planId as "monthly" | "three_month"]) {
      res.status(400).json({
        success: false,
        error: "Invalid plan selected. Choose 'monthly' (₹149) or 'three_month' (₹299).",
      });
      return;
    }

    const result = await createRazorpaySubscription({
      planId: planId as "monthly" | "three_month",
      email: String(email).trim(),
      name: name ? String(name).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      returnUrl: returnUrl ? String(returnUrl).trim() : undefined,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/subscriptions/verify
 * Verifies Razorpay checkout mandate signature & activates user membership in DB.
 */
export async function verifySubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { subscriptionId, paymentId, signature, email } = req.body;

    if (!subscriptionId) {
      res.status(400).json({
        success: false,
        error: "Subscription ID is required for verification.",
      });
      return;
    }

    const result = await verifyAndActivateSubscription({
      subscriptionId: String(subscriptionId).trim(),
      paymentId: paymentId ? String(paymentId).trim() : undefined,
      signature: signature ? String(signature).trim() : undefined,
      emailHint: email ? String(email).trim() : undefined,
    });

    if (result.success && result.isPremium) {
      const cleanEmail = email ? String(email).trim().toLowerCase() : "";
      await recordFunnelEvent({
        step: "subscribed",
        visitorId: cleanEmail || String(subscriptionId).trim(),
        email: cleanEmail,
        metadata: {
          subscriptionId: String(subscriptionId).trim(),
          paymentId: paymentId ? String(paymentId).trim() : undefined,
          plan: result.subscriptionPlan,
        },
      });
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/subscriptions/status/:subscriptionId
 * Queries status of a specific subscription.
 */
export async function getSubscriptionStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { subscriptionId } = req.params;
    const sub = await Subscription.findOne({
      $or: [{ subscriptionId }, { razorpaySubscriptionId: subscriptionId }],
    });

    if (!sub) {
      res.status(404).json({
        success: false,
        error: "Subscription not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      subscription: sub,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/subscriptions/webhook
 * Handles Razorpay Subscription Webhook events.
 */
export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = req.body;
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    await processRazorpayWebhook(payload, signature, rawBody);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
}
