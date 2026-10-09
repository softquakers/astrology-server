import { FunnelEvent, FunnelStep } from "../models/FunnelEvent.js";
import { User } from "../models/User.js";
import { AppInstall } from "../models/AppInstall.js";
import { ChartRecord } from "../models/ChartRecord.js";
import { Subscription } from "../models/Subscription.js";
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
 * Purges all synthetic / demo funnel records so analytics only show real user traffic.
 */
export async function purgeDemoFunnelData(): Promise<number> {
  if (!isDatabaseConnected()) return 0;
  try {
    const result = await FunnelEvent.deleteMany({
      $or: [
        { visitorId: { $regex: /^demo_/ } },
        { visitorId: { $regex: /^integration_/ } },
      ],
    });
    return result.deletedCount || 0;
  } catch (err) {
    console.warn("purgeDemoFunnelData warning:", err);
    return 0;
  }
}

/**
 * Synchronizes real historical records from User, ChartRecord, and AppInstall
 * into FunnelEvent so all genuine querents are properly reflected in the funnel pipeline.
 */
export async function syncRealFunnelData(): Promise<{ synced: number }> {
  if (!isDatabaseConnected()) return { synced: 0 };

  let count = 0;
  try {
    // Purge any residual demo visitors first
    await purgeDemoFunnelData();

    const [users, charts, installs, subscriptions] = await Promise.all([
      User.find({}).lean(),
      ChartRecord.find({}).lean(),
      AppInstall.find({}).lean(),
      Subscription.find({ status: "ACTIVE" }).lean(),
    ]);

    // Fetch existing real events to avoid duplicate step logging
    const existingEvents = await FunnelEvent.find(
      { visitorId: { $not: /^demo_/ } },
      "step visitorId"
    ).lean();

    const existingKeySet = new Set(
      existingEvents.map(e => `${e.step}:::${String(e.visitorId).toLowerCase().trim()}`)
    );

    const eventsToInsert: Array<{
      step: FunnelStep;
      visitorId: string;
      email: string;
      name: string;
      createdAt: Date;
    }> = [];

    const queueEvent = (
      step: FunnelStep,
      visitorId: string,
      email?: string,
      name?: string,
      createdAt?: Date
    ) => {
      const cleanVid = String(visitorId || "").trim().toLowerCase();
      if (!cleanVid) return;

      const key = `${step}:::${cleanVid}`;
      if (!existingKeySet.has(key)) {
        existingKeySet.add(key);
        eventsToInsert.push({
          step,
          visitorId: cleanVid,
          email: typeof email === "string" ? email.trim().toLowerCase() : "",
          name: typeof name === "string" ? name.trim() : "",
          createdAt: createdAt instanceof Date ? createdAt : new Date(),
        });
        count++;
      }
    };

    // 1. Process all registered users
    for (const u of users) {
      const vid = (u.email || u._id.toString()).trim().toLowerCase();
      const uEmail = u.email || "";
      const uName = u.name || "";
      const createdAt = u.createdAt || new Date();

      queueEvent("launch", vid, uEmail, uName, createdAt);
      if (u.name && u.name.trim()) {
        queueEvent("name", vid, uEmail, uName, createdAt);
      }
      if (u.photoUrl && u.photoUrl.trim()) {
        queueEvent("photo", vid, uEmail, uName, createdAt);
      }
      if (u.dob && u.dob.trim()) {
        queueEvent("dob", vid, uEmail, uName, createdAt);
      }
      if (u.birthTime && u.birthTime.trim()) {
        queueEvent("tob", vid, uEmail, uName, createdAt);
      }
      if (u.subscriptionStatus === "active" || u.isPremium) {
        queueEvent("subscribed", vid, uEmail, uName, u.updatedAt || createdAt);
      }
      if (u.isAppAttached) {
        queueEvent("attached", vid, uEmail, uName, u.appAttachedAt || createdAt);
      }
    }

    // 2. Process all chart calculations
    for (const c of charts) {
      const vid = (c.email && c.email.trim().toLowerCase()) || `chart_${c._id.toString()}`;
      const cEmail = c.email || "";
      const cName = c.name || "";
      const createdAt = c.createdAt || new Date();

      queueEvent("launch", vid, cEmail, cName, createdAt);
      if (c.name && c.name.trim()) {
        queueEvent("name", vid, cEmail, cName, createdAt);
      }
      if (c.date && c.date.trim()) {
        queueEvent("dob", vid, cEmail, cName, createdAt);
      }
      if (c.time && c.time.trim()) {
        queueEvent("tob", vid, cEmail, cName, createdAt);
      }
    }

    // 3. Process app screen attachments
    for (const ins of installs) {
      const vid = (ins.email && ins.email.trim().toLowerCase()) || `install_${ins._id.toString()}`;
      const insEmail = ins.email || "";
      const insName = ins.name || "";
      const createdAt = ins.createdAt || new Date();

      queueEvent("launch", vid, insEmail, insName, createdAt);
      queueEvent("attached", vid, insEmail, insName, createdAt);
    }

    // 4. Process active subscriptions
    for (const sub of subscriptions) {
      const vid = (sub.email && sub.email.trim().toLowerCase()) || `sub_${sub._id.toString()}`;
      queueEvent("launch", vid, sub.email, "", sub.createdAt);
      queueEvent("subscribed", vid, sub.email, "", sub.createdAt);
    }

    if (eventsToInsert.length > 0) {
      await FunnelEvent.insertMany(eventsToInsert);
    }
  } catch (err) {
    console.warn("syncRealFunnelData warning:", err);
  }

  return { synced: count };
}

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
    // Do not record demo events as real events
    if (cleanVisitorId.startsWith("demo_")) {
      return { success: true, recorded: false };
    }

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
 * Computes aggregated funnel conversion metrics using exclusively real database records
 * and live visitor events.
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
    // 1. Ensure any historical users/charts are synced and demo records are purged
    await syncRealFunnelData();

    // 2. Query distinct real visitor events (strictly excluding demo visitors)
    const realFilter = { visitorId: { $not: /^demo_/ } };

    const [
      launchVisitors,
      nameVisitors,
      photoVisitors,
      dobVisitors,
      tobVisitors,
      subscribedVisitors,
      attachedVisitors,
      users,
      charts,
      installs,
      activeSubs,
    ] = await Promise.all([
      FunnelEvent.distinct("visitorId", { step: "launch", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "name", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "photo", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "dob", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "tob", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "subscribed", ...realFilter }),
      FunnelEvent.distinct("visitorId", { step: "attached", ...realFilter }),
      User.find({}).lean(),
      ChartRecord.find({}).lean(),
      AppInstall.find({}).lean(),
      Subscription.find({ status: "ACTIVE" }).lean(),
    ]);

    // 3. Assemble unique sets of real people/devices for each milestone
    const setLaunch = new Set<string>(launchVisitors.map(v => String(v).toLowerCase()));
    const setName = new Set<string>(nameVisitors.map(v => String(v).toLowerCase()));
    const setPhoto = new Set<string>(photoVisitors.map(v => String(v).toLowerCase()));
    const setDob = new Set<string>(dobVisitors.map(v => String(v).toLowerCase()));
    const setTob = new Set<string>(tobVisitors.map(v => String(v).toLowerCase()));
    const setSubscribed = new Set<string>(subscribedVisitors.map(v => String(v).toLowerCase()));
    const setAttached = new Set<string>(attachedVisitors.map(v => String(v).toLowerCase()));

    // Incorporate real users
    for (const u of users) {
      const vid = (u.email || u._id.toString()).toLowerCase().trim();
      setLaunch.add(vid);
      if (u.name && u.name.trim()) setName.add(vid);
      if (u.photoUrl && u.photoUrl.trim()) setPhoto.add(vid);
      if (u.dob && u.dob.trim()) setDob.add(vid);
      if (u.birthTime && u.birthTime.trim()) setTob.add(vid);
      if (u.subscriptionStatus === "active" || u.isPremium) setSubscribed.add(vid);
      if (u.isAppAttached) setAttached.add(vid);
    }

    // Incorporate real charts
    for (const c of charts) {
      const vid = (c.email && c.email.trim().toLowerCase()) || `chart_${c._id.toString()}`;
      setLaunch.add(vid);
      if (c.name && c.name.trim()) setName.add(vid);
      if (c.date && c.date.trim()) setDob.add(vid);
      if (c.time && c.time.trim()) setTob.add(vid);
    }

    // Incorporate app installs
    for (const ins of installs) {
      const vid = (ins.email && ins.email.trim().toLowerCase()) || `install_${ins._id.toString()}`;
      setLaunch.add(vid);
      setAttached.add(vid);
    }

    // Incorporate active subscriptions
    for (const s of activeSubs) {
      const vid = (s.email && s.email.trim().toLowerCase()) || `sub_${s._id.toString()}`;
      setLaunch.add(vid);
      setSubscribed.add(vid);
    }

    // Funnel pipeline progression: querents who reached deeper stages had to pass initial stages
    const countAttached = setAttached.size;
    const countSubscribed = setSubscribed.size;
    const countTob = setTob.size;
    const countDob = Math.max(setDob.size, countTob);
    const countPhoto = setPhoto.size;
    const countName = Math.max(setName.size, countDob, countPhoto);
    const countLaunch = Math.max(setLaunch.size, countName);

    const counts: Record<FunnelStep, number> = {
      launch: countLaunch,
      name: countName,
      photo: countPhoto,
      dob: countDob,
      tob: countTob,
      subscribed: countSubscribed,
      attached: countAttached,
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
          pctFromPrev = stepCount > 0 ? 100 : 0;
          dropoffCount = 0;
          dropoffPct = 0;
        }
      }

      // Update prevCount for subsequent comparison
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
 * Seeds demo funnel events if explicitly requested for testing in staging.
 */
export async function seedFunnelDemoData(): Promise<void> {
  if (!isDatabaseConnected()) return;

  try {
    // Purge prior demo events
    await purgeDemoFunnelData();

    const sampleNames = [
      "Aarav Sharma", "Priya Patel", "Vikram Joshi", "Ananya Gupta",
      "Rohan Verma", "Sneha Rao", "Karan Malhotra", "Meera Nair",
      "Arjun Kapoor", "Diya Sengupta", "Kabir Mehta", "Ishita Chawla"
    ];

    const totalVisitors = 30;
    const eventsToInsert = [];
    const now = Date.now();

    for (let i = 1; i <= totalVisitors; i++) {
      const visitorId = `demo_visitor_${1000 + i}`;
      const name = sampleNames[i % sampleNames.length];
      const email = `demo_visitor${i}@example.com`;
      const createdAt = new Date(now - i * 3600000);

      eventsToInsert.push({
        step: "launch" as FunnelStep,
        visitorId,
        sessionId: `sess_${visitorId}`,
        createdAt,
      });

      if (i <= 22) {
        eventsToInsert.push({
          step: "name" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 15000),
        });
      }
      if (i <= 16) {
        eventsToInsert.push({
          step: "photo" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 35000),
        });
      }
      if (i <= 14) {
        eventsToInsert.push({
          step: "dob" as FunnelStep,
          visitorId,
          name,
          createdAt: new Date(createdAt.getTime() + 55000),
        });
      }
      if (i <= 12) {
        eventsToInsert.push({
          step: "tob" as FunnelStep,
          visitorId,
          name,
          email,
          createdAt: new Date(createdAt.getTime() + 75000),
        });
      }
      if (i <= 4) {
        eventsToInsert.push({
          step: "subscribed" as FunnelStep,
          visitorId,
          name,
          email,
          createdAt: new Date(createdAt.getTime() + 120000),
        });
      }
      if (i <= 3) {
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
