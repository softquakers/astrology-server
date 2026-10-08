import { Router } from "express";
import {
  getPlans,
  createSubscription,
  verifySubscription,
  getSubscriptionStatus,
  handleWebhook,
} from "../controllers/subscriptionController.js";

const router = Router();

// GET /api/subscriptions/plans - Fetch pricing plans (149 monthly, 299 3-month)
router.get("/plans", getPlans);

// POST /api/subscriptions/create - Initialize Razorpay UPI AutoPay mandate
router.post("/create", createSubscription);

// POST /api/subscriptions/verify - Verify mandate approval & activate user
router.post("/verify", verifySubscription);

// GET /api/subscriptions/status/:subscriptionId - Check mandate status
router.get("/status/:subscriptionId", getSubscriptionStatus);

// POST /api/subscriptions/webhook - Razorpay subscription webhooks
router.post("/webhook", handleWebhook);

export default router;
