import crypto from "crypto";
import { config } from "../config/index.js";
import { User } from "../models/User.js";
import { Subscription, SubscriptionPlanId } from "../models/Subscription.js";

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  amount: number; // in INR (₹149 / ₹299)
  amountPaise: number; // in paise (14900 / 29900)
  period: "monthly";
  interval: number; // 1 for monthly, 3 for 3-month
  badge?: string;
  savings?: string;
  perMonthText: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, PlanConfig> = {
  monthly: {
    id: "monthly",
    name: "Celestial Monthly AutoPay",
    tagline: "Unlimited cosmic queries billed monthly via UPI AutoPay",
    amount: 149,
    amountPaise: 14900,
    period: "monthly",
    interval: 1,
    perMonthText: "₹149 / month",
    features: [
      "Unlimited natal chart query analysis",
      "Instant planetary transit readings & answers",
      "Automated monthly renewal via Razorpay UPI AutoPay",
      "Cancel anytime from your UPI App or dashboard",
      "Secure NPCI UPI AutoPay mandate (Google Pay, PhonePe, Paytm)",
    ],
  },
  three_month: {
    id: "three_month",
    name: "Celestial 3-Month AutoPay",
    tagline: "Best Value: 90 days of deep transit & question forecasts",
    amount: 299,
    amountPaise: 29900,
    period: "monthly",
    interval: 3,
    badge: "Most Popular · Save 33%",
    savings: "Save 33% (₹99.6/mo)",
    perMonthText: "₹299 for 3 months",
    features: [
      "All Monthly Plan features included",
      "90-day complete solar & transit horizon",
      "Save 33% compared to monthly billing",
      "Priority chart synthesis & aspect calculations",
      "Effortless renewal every 3 months via Razorpay UPI AutoPay",
      "Cancel anytime with 1-click mandate pause",
    ],
  },
};

// In-memory cache for created Razorpay plan IDs
const cachedPlanIds: Partial<Record<SubscriptionPlanId, string>> = {};

/**
 * Encodes basic auth header for Razorpay API.
 */
function getRazorpayAuthHeader(): string {
  const credentials = `${config.razorpay.keyId}:${config.razorpay.keySecret}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

/**
 * Normalizes phone number for Indian UPI Mandates (10 digits).
 */
function cleanPhoneNumber(phone?: string): string {
  if (!phone) return "9876543210";
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits.padEnd(10, "0");
}

/**
 * Retrieves or creates a plan in Razorpay for subscriptions.
 */
async function getOrCreateRazorpayPlanId(planConfig: PlanConfig): Promise<string> {
  // Check configured env overrides
  if (planConfig.id === "monthly" && config.razorpay.planMonthlyId) {
    return config.razorpay.planMonthlyId;
  }
  if (planConfig.id === "three_month" && config.razorpay.planThreeMonthId) {
    return config.razorpay.planThreeMonthId;
  }

  // Check cache
  if (cachedPlanIds[planConfig.id]) {
    return cachedPlanIds[planConfig.id]!;
  }

  // Create plan in Razorpay via REST API
  const planPayload = {
    period: planConfig.period,
    interval: planConfig.interval,
    item: {
      name: planConfig.name,
      amount: planConfig.amountPaise,
      currency: "INR",
      description: planConfig.tagline,
    },
  };

  const response = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getRazorpayAuthHeader(),
    },
    body: JSON.stringify(planPayload),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    console.error("Razorpay Plan creation error:", data);
    throw new Error(data?.error?.description || `Razorpay Plan API returned HTTP ${response.status}`);
  }

  cachedPlanIds[planConfig.id] = data.id;
  return data.id;
}

export interface CreateSubscriptionParams {
  planId: SubscriptionPlanId;
  email: string;
  name?: string;
  phone?: string;
  returnUrl?: string;
}

export interface CreateSubscriptionResult {
  success: boolean;
  subscriptionId: string;
  authLink: string;
  keyId?: string;
  razorpayPlanId?: string;
  plan: PlanConfig;
  isDemo: boolean;
  message?: string;
}

/**
 * Creates a UPI AutoPay subscription via Razorpay (or sandbox simulation if keys pending).
 */
export async function createRazorpaySubscription(
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const plan = SUBSCRIPTION_PLANS[params.planId];
  if (!plan) {
    throw new Error(`Invalid subscription plan: ${params.planId}`);
  }

  const cleanEmail = params.email.toLowerCase().trim();
  const cleanName = params.name?.trim() || cleanEmail.split("@")[0];
  const cleanPhone = cleanPhoneNumber(params.phone);

  // 1. If Razorpay credentials configured, call Razorpay Subscriptions API
  if (config.razorpay.isConfigured) {
    try {
      const razorpayPlanId = await getOrCreateRazorpayPlanId(plan);

      // Total count: 60 billing cycles (5 years of recurring AutoPay)
      const subPayload = {
        plan_id: razorpayPlanId,
        total_count: 60,
        quantity: 1,
        customer_notify: 1,
        notes: {
          email: cleanEmail,
          name: cleanName,
          phone: cleanPhone,
          planId: plan.id,
          source: "astrology_pwa",
        },
      };

      const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getRazorpayAuthHeader(),
        },
        body: JSON.stringify(subPayload),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        console.error("Razorpay Subscription API error:", data);
        throw new Error(data?.error?.description || `Razorpay API returned HTTP ${response.status}`);
      }

      const rzpSubId = data.id;
      const authLink = data.short_url || "";

      // Store in DB
      await Subscription.create({
        subscriptionId: rzpSubId,
        razorpaySubscriptionId: rzpSubId,
        razorpayPlanId,
        email: cleanEmail,
        name: cleanName,
        phone: cleanPhone,
        planId: plan.id,
        planName: plan.name,
        amount: plan.amount,
        currency: "INR",
        interval: "MONTH",
        intervals: plan.interval,
        status: (data.status || "INITIALIZED").toUpperCase(),
        paymentMethod: "upi_autopay",
        authLink,
        isDemo: false,
        rawResponse: data,
      });

      return {
        success: true,
        subscriptionId: rzpSubId,
        authLink,
        keyId: config.razorpay.keyId,
        razorpayPlanId,
        plan,
        isDemo: false,
      };
    } catch (err: any) {
      console.warn("Real Razorpay call failed, falling back to simulated sandbox mode:", err.message);
    }
  }

  // 2. Demo / Sandbox Simulation Mode (Keys missing or test simulation)
  const simSubId = `sub_rzp_sim_${plan.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const demoAuthLink = `${config.clientOrigin}/?tab=Plans&demo_auth=1&sub_id=${simSubId}&plan=${plan.id}&amount=${plan.amount}`;

  await Subscription.create({
    subscriptionId: simSubId,
    razorpaySubscriptionId: simSubId,
    email: cleanEmail,
    name: cleanName,
    phone: cleanPhone,
    planId: plan.id,
    planName: plan.name,
    amount: plan.amount,
    currency: "INR",
    interval: "MONTH",
    intervals: plan.interval,
    status: "INITIALIZED",
    paymentMethod: "upi_autopay",
    authLink: demoAuthLink,
    isDemo: true,
    rawResponse: {
      mode: "sandbox_simulation",
      note: "Configure RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env for live gateway",
    },
  });

  return {
    success: true,
    subscriptionId: simSubId,
    authLink: demoAuthLink,
    keyId: config.razorpay.keyId || "rzp_test_simulation",
    plan,
    isDemo: true,
    message: "Simulation mode active. Enter RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env for live gateway.",
  };
}

/**
 * Validates Razorpay checkout subscription signature.
 * Format: HMAC SHA256 of `payment_id|subscription_id` using Razorpay Key Secret.
 */
export function verifyRazorpaySignature(
  paymentId: string,
  subscriptionId: string,
  signature: string
): boolean {
  if (!config.razorpay.keySecret) return false;
  try {
    const payload = `${paymentId}|${subscriptionId}`;
    const expected = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(payload)
      .digest("hex");
    return expected === signature;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/**
 * Verifies subscription status and activates user membership in DB.
 */
export async function verifyAndActivateSubscription(params: {
  subscriptionId: string;
  paymentId?: string;
  signature?: string;
  emailHint?: string;
}): Promise<{
  success: boolean;
  status: string;
  isPremium: boolean;
  subscriptionPlan: string;
  user?: any;
  subscription?: any;
  error?: string;
}> {
  const { subscriptionId, paymentId, signature, emailHint } = params;
  let subRecord = await Subscription.findOne({
    $or: [{ subscriptionId }, { razorpaySubscriptionId: subscriptionId }],
  });

  let isPaidOrActive = false;
  let statusString = "ACTIVE";

  if (subRecord && subRecord.isDemo) {
    // In demo simulation mode, completing the flow grants active status
    isPaidOrActive = true;
    statusString = "ACTIVE";
  } else if (config.razorpay.isConfigured) {
    // Check signature if provided from Razorpay checkout
    if (paymentId && signature) {
      const signatureValid = verifyRazorpaySignature(paymentId, subscriptionId, signature);
      if (signatureValid) {
        isPaidOrActive = true;
        statusString = "ACTIVE";
      }
    }

    // Query Razorpay Subscription API for live status
    try {
      const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: {
          Authorization: getRazorpayAuthHeader(),
        },
      });

      if (response.ok) {
        const rzpData = (await response.json()) as any;
        const currentRzpStatus = (rzpData.status || "").toLowerCase();
        if (
          currentRzpStatus === "active" ||
          currentRzpStatus === "authenticated" ||
          currentRzpStatus === "completed"
        ) {
          isPaidOrActive = true;
          statusString = "ACTIVE";
        } else {
          statusString = currentRzpStatus.toUpperCase();
        }
      }
    } catch (e) {
      console.error("Error querying Razorpay subscription status:", e);
    }
  } else {
    // Unconfigured fallback simulation
    isPaidOrActive = true;
    statusString = "ACTIVE";
  }

  const targetEmail =
    subRecord?.email || (emailHint ? emailHint.toLowerCase().trim() : "");

  const now = new Date();
  const intervals = subRecord?.intervals || 1;
  const nextBilling = new Date(now.getTime() + intervals * 30 * 24 * 60 * 60 * 1000);

  if (subRecord) {
    subRecord.status = statusString as any;
    if (paymentId) subRecord.razorpayPaymentId = paymentId;
    if (signature) subRecord.razorpaySignature = signature;
    if (isPaidOrActive) {
      subRecord.activatedAt = now;
      subRecord.nextBillingDate = nextBilling;
    }
    await subRecord.save();
  }

  let user = null;
  if (targetEmail && isPaidOrActive) {
    const planId = subRecord?.planId || "monthly";
    const amount = subRecord?.amount || (planId === "three_month" ? 299 : 149);

    user = await User.findOneAndUpdate(
      { email: targetEmail },
      {
        $set: {
          isPremium: true,
          subscriptionStatus: "active",
          subscriptionPlan: planId,
          monthlyFee: amount,
          paymentMethod: "upi_autopay",
          lastPaymentDate: now,
          nextBillingDate: nextBilling,
          razorpaySubscriptionId: subscriptionId,
          razorpayPaymentId: paymentId || "",
          razorpayPlanId: subRecord?.razorpayPlanId || "",
        },
      },
      { new: true }
    );
  }

  return {
    success: isPaidOrActive,
    status: statusString,
    isPremium: isPaidOrActive,
    subscriptionPlan: subRecord?.planId || "monthly",
    user,
    subscription: subRecord,
  };
}

/**
 * Handles Razorpay Subscription Webhook events.
 */
export async function processRazorpayWebhook(
  payload: any,
  signatureHeader?: string,
  rawBody?: string
): Promise<void> {
  // Validate webhook signature if webhookSecret is configured
  if (config.razorpay.webhookSecret && signatureHeader && rawBody) {
    try {
      const expected = crypto
        .createHmac("sha256", config.razorpay.webhookSecret)
        .update(rawBody)
        .digest("hex");
      if (expected !== signatureHeader) {
        console.warn("Razorpay Webhook signature mismatch");
        return;
      }
    } catch (e) {
      console.error("Razorpay webhook signature verification error:", e);
      return;
    }
  }

  const event = payload?.event;
  const subData =
    payload?.payload?.subscription?.entity ||
    payload?.payload?.payment?.entity;
  const subId =
    subData?.subscription_id ||
    (payload?.payload?.subscription?.entity?.id) ||
    subData?.id;

  if (!subId) return;

  const sub = await Subscription.findOne({
    $or: [{ subscriptionId: subId }, { razorpaySubscriptionId: subId }],
  });
  if (!sub) return;

  const now = new Date();
  const intervals = sub.intervals || 1;
  const nextBilling = new Date(now.getTime() + intervals * 30 * 24 * 60 * 60 * 1000);

  if (
    event === "subscription.authenticated" ||
    event === "subscription.activated" ||
    event === "subscription.charged"
  ) {
    sub.status = "ACTIVE";
    sub.activatedAt = now;
    sub.nextBillingDate = nextBilling;
    await sub.save();

    await User.findOneAndUpdate(
      { email: sub.email },
      {
        $set: {
          isPremium: true,
          subscriptionStatus: "active",
          subscriptionPlan: sub.planId,
          monthlyFee: sub.amount,
          paymentMethod: "upi_autopay",
          lastPaymentDate: now,
          nextBillingDate: nextBilling,
          razorpaySubscriptionId: subId,
        },
      }
    );
  } else if (
    event === "subscription.cancelled" ||
    event === "subscription.halted" ||
    event === "subscription.completed"
  ) {
    const isCancelled = event === "subscription.cancelled";
    sub.status = (isCancelled ? "CANCELLED" : "COMPLETED") as any;
    await sub.save();

    await User.findOneAndUpdate(
      { email: sub.email },
      {
        $set: {
          isPremium: false,
          subscriptionStatus: isCancelled ? "canceled" : "free",
        },
      }
    );
  } else if (event === "subscription.paused") {
    sub.status = "PAUSED";
    await sub.save();
  } else if (event === "subscription.resumed") {
    sub.status = "ACTIVE";
    await sub.save();
  }
}
