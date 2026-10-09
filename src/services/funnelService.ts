import { FunnelEvent, FunnelStep } from "../models/FunnelEvent.js";
import { User } from "../models/User.js";
import { AppInstall } from "../models/AppInstall.js";
import { isDatabaseConnected } from "../config/database.js";

export interface FunnelRecordInput {
  step: FunnelStep;
  visitorId: string;
  sessionId?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface FunnelStepMetric {
  id: FunnelStep;
  stepNumber: number;
  label: string;
  desc: string;
  icon: string;
  count: number;
  pctOfTotal: number;
  pctFromPrev: number;
  dropoffCount: number;
  dropoffPct: number;
  gradient: string;
  badgeBg: string;
  accentColor: string;
}

export interface FunnelMetricsSummary {
  steps: FunnelStepMetric[];
  totalLaunches: number;
  nameCompleted: number;
  photoCompleted: number;
  dobCompleted: number;
  tobCompleted: number;
  subscribedCount: number;
  attachedCount: number;
  overallPaidRate: number;
  overallAttachRate: number;
  profileCompletionRate: number;
}

const STEP_DEFINITIONS: {
  id: FunnelStep;
  stepNumber: number;
  label: string;
  desc: string;
  icon: string;
  gradient: string;
  badgeBg: string;
  accentColor: string;
}[] = [
  {
    id: "launch",
    stepNumber: 1,
    label: "Launched App",
    desc: "App opened in browser or PWA viewport",
    icon: "🚀",
    gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    accentColor: "#a78bfa",
  },
  {
    id: "name",
    stepNumber: 2,
    label: "Entered Name",
    desc: "Submitted querent name / identity",
    icon: "👤",
    gradient: "linear-gradient(135deg, #6366f1, #3b82f6)",
    badgeBg: "rgba(99, 102, 241, 0.15)",
    accentColor: "#818cf8",
  },
  {
    id: "photo",
    stepNumber: 3,
    label: "Took Photo",
    desc: "Captured camera snapshot or uploaded portrait",
    icon: "📸",
    gradient: "linear-gradient(135deg, #06b6d4, #0284c7)",
    badgeBg: "rgba(6, 182, 212, 0.15)",
    accentColor: "#38bdf8",
  },
  {
    id: "dob",
    stepNumber: 4,
    label: "Entered DOB",
    desc: "Provided date of birth for natal alignment",
    icon: "📅",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    accentColor: "#34d399",
  },
  {
    id: "tob",
    stepNumber: 5,
    label: "Time of Birth",
    desc: "Supplied exact birth time for Ascendant & Houses",
    icon: "🕒",
    gradient: "linear-gradient(135deg, #14b8a6, #0d9488)",
    badgeBg: "rgba(20, 184, 166, 0.15)",
    accentColor: "#2dd4bf",
  },
  {
    id: "subscribed",
    stepNumber: 6,
    label: "Subscribed",
    desc: "Completed paid subscription or active tier unlock",
    icon: "💎",
    gradient: "linear-gradient(135deg, #e8b86b, #ffd384)",
    badgeBg: "rgba(232, 184, 107, 0.18)",
    accentColor: "#e8b86b",
  },
  {
    id: "attached",
    stepNumber: 7,
    label: "Attached to Home Screen",
    desc: "Saved app icon to phone / desktop home screen",
    icon: "📲",
    gradient: "linear-gradient(135deg, #ec4899, #f43f5e)",
    badgeBg: "rgba(236, 72, 153, 0.15)",
    accentColor: "#f472b6",
  },
];

/**
 * Records an onboarding / conversion funnel event.
 */
export async function recordFunnelEvent(
  input: FunnelRecordInput
): Promise<{ success: boolean; recorded: boolean; offline?: boolean }> {
  try {
    const { step, visitorId, sessionId, email, name, metadata } = input;
    if (!step || !visitorId) {
      return { success: false, recorded: false };
    }

    const cleanVisitorId = visitorId.trim();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanName = typeof name === "string" ? name.trim() : "";

    if (!isDatabaseConnected()) {
      return { success: true, recorded: false, offline: true };
    }

    // Record the funnel event
    await FunnelEvent.create({
      step,
      visitorId: cleanVisitorId,
      sessionId: sessionId || "",
      email: cleanEmail,
      name: cleanName,
      metadata: metadata || {},
    });

    // If an email is linked, update user attributes where appropriate
    if (cleanEmail) {
      const updateData: Record<string, any> = {};
      if (cleanName && step === "name") updateData.name = cleanName;
      if (step === "attached") {
        updateData.isAppAttached = true;
        updateData.appAttachedAt = new Date();
      }
      if (step === "subscribed") {
        updateData.isPremium = true;
        updateData.subscriptionStatus = "active";
      }

      if (Object.keys(updateData).length > 0) {
        await User.findOneAndUpdate({ email: cleanEmail }, { $set: updateData });
      }
    }

    return { success: true, recorded: true };
  } catch (err) {
    console.warn("recordFunnelEvent warning:", err);
    return { success: false, recorded: false };
  }
}

/**
 * Computes aggregated funnel conversion metrics and step-by-step drop-offs.
 */
export async function getFunnelMetrics(): Promise<FunnelMetricsSummary> {
  const emptyResult: FunnelMetricsSummary = {
    steps: STEP_DEFINITIONS.map(def => ({
      ...def,
      count: 0,
      pctOfTotal: 0,
      pctFromPrev: 0,
      dropoffCount: 0,
      dropoffPct: 0,
    })),
    totalLaunches: 0,
    nameCompleted: 0,
    photoCompleted: 0,
    dobCompleted: 0,
    tobCompleted: 0,
    subscribedCount: 0,
    attachedCount: 0,
    overallPaidRate: 0,
    overallAttachRate: 0,
    profileCompletionRate: 0,
  };

  if (!isDatabaseConnected()) {
    return emptyResult;
  }

  try {
    // 1. Query unique visitors per step in FunnelEvent collection
    const [
      launchVisitors,
      nameVisitors,
      photoVisitors,
      dobVisitors,
      tobVisitors,
      subscribedVisitors,
      attachedVisitors,
      totalUsers,
      usersWithName,
      usersWithPhoto,
      usersWithDob,
      usersWithTob,
      usersSubscribed,
      usersAttached,
      appInstallsCount,
    ] = await Promise.all([
      FunnelEvent.distinct("visitorId", { step: "launch" }),
      FunnelEvent.distinct("visitorId", { step: "name" }),
      FunnelEvent.distinct("visitorId", { step: "photo" }),
      FunnelEvent.distinct("visitorId", { step: "dob" }),
      FunnelEvent.distinct("visitorId", { step: "tob" }),
      FunnelEvent.distinct("visitorId", { step: "subscribed" }),
      FunnelEvent.distinct("visitorId", { step: "attached" }),
      User.countDocuments(),
      User.countDocuments({ name: { $exists: true, $ne: "" } }),
      User.countDocuments({ photoUrl: { $exists: true, $ne: "" } }),
      User.countDocuments({ dob: { $exists: true, $ne: "" } }),
      User.countDocuments({ birthTime: { $exists: true, $ne: "" } }),
      User.countDocuments({ subscriptionStatus: "active" }),
      User.countDocuments({ isAppAttached: true }),
      AppInstall.countDocuments(),
    ]);

    // Reconcile raw event counts with registered users & installs to ensure historical consistency
    const rawAttached = Math.max(attachedVisitors.length, usersAttached, appInstallsCount);
    const rawSubscribed = Math.max(subscribedVisitors.length, usersSubscribed);
    const rawTob = Math.max(tobVisitors.length, usersWithTob);
    const rawDob = Math.max(dobVisitors.length, usersWithDob, rawTob);
    const rawPhoto = Math.max(photoVisitors.length, usersWithPhoto, rawDob);
    const rawName = Math.max(nameVisitors.length, usersWithName, rawPhoto);
    const rawLaunch = Math.max(launchVisitors.length, totalUsers, rawName);

    // Compute step values ensuring proper monotonic funnel logic for display
    const counts: Record<FunnelStep, number> = {
      launch: rawLaunch,
      name: rawName,
      photo: rawPhoto,
      dob: rawDob,
      tob: rawTob,
      subscribed: rawSubscribed,
      attached: rawAttached,
    };

    const totalLaunches = counts.launch;
    const baseTotal = totalLaunches > 0 ? totalLaunches : 1;

    let prevCount = totalLaunches;

    const steps: FunnelStepMetric[] = STEP_DEFINITIONS.map((def, idx) => {
      const stepCount = counts[def.id] || 0;
      const pctOfTotal = totalLaunches > 0 ? Math.round((stepCount / baseTotal) * 100) : 0;

      let pctFromPrev = 100;
      let dropoffCount = 0;
      let dropoffPct = 0;

      if (idx > 0) {
        if (prevCount > 0) {
          pctFromPrev = Math.min(100, Math.round((stepCount / prevCount) * 100));
          dropoffCount = Math.max(0, prevCount - stepCount);
          dropoffPct = Math.max(0, 100 - pctFromPrev);
        } else {
          pctFromPrev = 0;
          dropoffCount = 0;
          dropoffPct = 0;
        }
      }

      // Update prevCount for next step comparison
      prevCount = stepCount;

      return {
        ...def,
        count: stepCount,
        pctOfTotal,
        pctFromPrev,
        dropoffCount,
        dropoffPct,
      };
    });

    const overallPaidRate = totalLaunches > 0 ? Math.round((counts.subscribed / baseTotal) * 100) : 0;
    const overallAttachRate = totalLaunches > 0 ? Math.round((counts.attached / baseTotal) * 100) : 0;
    const profileCompletionRate = totalLaunches > 0 ? Math.round((counts.tob / baseTotal) * 100) : 0;

    return {
      steps,
      totalLaunches,
      nameCompleted: counts.name,
      photoCompleted: counts.photo,
      dobCompleted: counts.dob,
      tobCompleted: counts.tob,
      subscribedCount: counts.subscribed,
      attachedCount: counts.attached,
      overallPaidRate,
      overallAttachRate,
      profileCompletionRate,
    };
  } catch (err) {
    console.error("getFunnelMetrics calculation error:", err);
    return emptyResult;
  }
}

/**
 * Seeds demo funnel events corresponding to realistic visitor drop-off curves.
 */
export async function seedFunnelDemoData(): Promise<void> {
  if (!isDatabaseConnected()) return;

  try {
    // Clear existing events before seeding clean demo set
    await FunnelEvent.deleteMany({});

    // Target funnel proportions for realistic demo:
    // 140 Launches -> 105 Names -> 82 Photos -> 64 DOBs -> 58 TOBs -> 21 Subscribed -> 16 Attached
    const sampleNames = [
      "Aarav Sharma", "Priya Patel", "Vikram Joshi", "Ananya Gupta",
      "Rohan Verma", "Sneha Rao", "Karan Malhotra", "Meera Nair",
      "Arjun Kapoor", "Diya Sengupta", "Kabir Mehta", "Ishita Chawla",
      "Nikhil Deshmukh", "Pooja Reddy", "Aditya Bose", "Sunita Pillai"
    ];

    const totalVisitors = 140;
    const nameDropoffAt = 105;
    const photoDropoffAt = 82;
    const dobDropoffAt = 64;
    const tobDropoffAt = 58;
    const subscribedDropoffAt = 21;
    const attachedDropoffAt = 16;

    const eventsToInsert = [];
    const now = Date.now();

    for (let i = 1; i <= totalVisitors; i++) {
      const visitorId = `demo_visitor_${1000 + i}`;
      const name = sampleNames[i % sampleNames.length];
      const email = `visitor${i}@example.com`;
      const timeOffset = Math.floor(Math.random() * (7 * 24 * 60 * 60 * 1000)); // past 7 days
      const createdAt = new Date(now - timeOffset);

      // Step 1: Launch
      eventsToInsert.push({
        step: "launch" as FunnelStep,
        visitorId,
        sessionId: `sess_${visitorId}`,
        createdAt,
      });

      // Step 2: Name
      if (i <= nameDropoffAt) {
        eventsToInsert.push({
          step: "name" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 15000),
        });
      }

      // Step 3: Photo
      if (i <= photoDropoffAt) {
        eventsToInsert.push({
          step: "photo" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 35000),
        });
      }

      // Step 4: DOB
      if (i <= dobDropoffAt) {
        eventsToInsert.push({
          step: "dob" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 55000),
        });
      }

      // Step 5: TOB
      if (i <= tobDropoffAt) {
        eventsToInsert.push({
          step: "tob" as FunnelStep,
          visitorId,
          name,
          email,
          createdAt: new Date(createdAt.getTime() + 75000),
        });
      }

      // Step 6: Subscribed
      if (i <= subscribedDropoffAt) {
        eventsToInsert.push({
          step: "subscribed" as FunnelStep,
          visitorId,
          name,
          email,
          createdAt: new Date(createdAt.getTime() + 120000),
        });
      }

      // Step 7: Attached
      if (i <= attachedDropoffAt) {
        eventsToInsert.push({
          step: "attached" as FunnelStep,
          visitorId,
          name,
          email,
          createdAt: new Date(createdAt.getTime() + 180000),
        });
      }
    }

    await FunnelEvent.insertMany(eventsToInsert);
  } catch (err) {
    console.warn("seedFunnelDemoData warning:", err);
  }
}
