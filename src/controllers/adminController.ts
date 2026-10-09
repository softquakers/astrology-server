import { Request, Response, NextFunction } from "express";
import { User, IUser, SubscriptionStatus } from "../models/User.js";
import { ChartRecord } from "../models/ChartRecord.js";
import { AppInstall } from "../models/AppInstall.js";
import { isDatabaseConnected, getDatabaseStatus } from "../config/database.js";

/**
 * Renders the Admin Dashboard with user statistics and subscription payment overview.
 */
export async function getAdminDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dbStatus = getDatabaseStatus();

    // If database is not connected, render dashboard with empty/offline state
    if (!dbStatus.connected) {
      res.render("admin/dashboard", {
        dbConnected: false,
        dbStatus,
        stats: {
          totalUsers: 0,
          subscribedUsers: 0,
          unpaidUsers: 0,
          freeUsers: 0,
          attachedCount: 0,
          attachedRate: 0,
          mrr: 0,
          unpaidRevenue: 0,
          totalCharts: 0,
          paidRate: 0,
        },
        users: [],
        recentAttachments: [],
        currentFilter: "all",
        searchQuery: "",
        alert: {
          type: "warning",
          message: "MongoDB is currently disconnected. Start your MongoDB server or configure MONGODB_URI in .env to view live data.",
        },
      });
      return;
    }

    const { filter = "all", q = "", alertType, alertMsg } = req.query;
    const filterQuery: Record<string, unknown> = {};

    // Filter by subscription status or screen attachment
    if (filter === "subscribed") {
      filterQuery.subscriptionStatus = "active";
    } else if (filter === "unpaid") {
      filterQuery.subscriptionStatus = { $in: ["unpaid", "past_due"] };
    } else if (filter === "free") {
      filterQuery.subscriptionStatus = "free";
    } else if (filter === "attached") {
      filterQuery.isAppAttached = true;
    }

    // Search by name or email
    if (q && typeof q === "string" && q.trim()) {
      const searchRegex = new RegExp(q.trim(), "i");
      filterQuery.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    // Aggregated statistics
    const [
      totalUsers,
      subscribedUsers,
      unpaidUsers,
      freeUsers,
      attachedCount,
      totalCharts,
      allSubscribedList,
      allUnpaidList,
      users,
      recentAttachments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ subscriptionStatus: "active" }),
      User.countDocuments({ subscriptionStatus: { $in: ["unpaid", "past_due"] } }),
      User.countDocuments({ subscriptionStatus: "free" }),
      User.countDocuments({ isAppAttached: true }),
      ChartRecord.countDocuments(),
      User.find({ subscriptionStatus: "active" }).select("monthlyFee").lean(),
      User.find({ subscriptionStatus: { $in: ["unpaid", "past_due"] } }).select("monthlyFee").lean(),
      User.find(filterQuery).sort({ createdAt: -1 }).limit(100).lean(),
      AppInstall.find().sort({ createdAt: -1 }).limit(15).lean(),
    ]);

    // Calculate Monthly Recurring Revenue (MRR)
    const mrr = allSubscribedList.reduce((acc, u) => acc + (u.monthlyFee || 9.99), 0);

    // Calculate Unpaid Monthly Subscription Fees
    const unpaidRevenue = allUnpaidList.reduce((acc, u) => acc + (u.monthlyFee || 9.99), 0);

    // Calculate percentage of paid subscribers vs total registered users
    const paidRate = totalUsers > 0 ? Math.round((subscribedUsers / totalUsers) * 100) : 0;

    // Calculate percentage of users who attached app to home screen
    const attachedRate = totalUsers > 0 ? Math.round((attachedCount / totalUsers) * 100) : 0;

    let alert = null;
    if (alertType && alertMsg) {
      alert = {
        type: String(alertType),
        message: String(alertMsg),
      };
    }

    res.render("admin/dashboard", {
      dbConnected: true,
      dbStatus,
      stats: {
        totalUsers,
        subscribedUsers,
        unpaidUsers,
        freeUsers,
        attachedCount,
        attachedRate,
        mrr: Number(mrr.toFixed(2)),
        unpaidRevenue: Number(unpaidRevenue.toFixed(2)),
        totalCharts,
        paidRate,
      },
      users,
      recentAttachments,
      currentFilter: String(filter),
      searchQuery: String(q || ""),
      alert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new user profile directly from Admin Dashboard.
 */
export async function postCreateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.redirect("/admin?alertType=error&alertMsg=MongoDB+is+disconnected");
      return;
    }

    const { name, email, subscriptionStatus, subscriptionPlan, monthlyFee } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.redirect("/admin?alertType=error&alertMsg=Valid+email+address+is+required");
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const defaultFee = subscriptionPlan === "three_month" ? 299 : 149;
    const fee = parseFloat(monthlyFee) || (subscriptionStatus === "active" || subscriptionStatus === "unpaid" ? defaultFee : 0);
    const now = new Date();
    const nextBilling = new Date();
    if (subscriptionPlan === "three_month") {
      nextBilling.setMonth(nextBilling.getMonth() + 3);
    } else {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    await User.findOneAndUpdate(
      { email: cleanEmail },
      {
        name: name?.trim() || cleanEmail.split("@")[0],
        email: cleanEmail,
        isPremium: subscriptionStatus === "active",
        subscriptionStatus: subscriptionStatus || "free",
        subscriptionPlan: subscriptionPlan || "monthly",
        monthlyFee: fee,
        lastPaymentDate: subscriptionStatus === "active" ? now : null,
        nextBillingDate: subscriptionStatus === "active" || subscriptionStatus === "unpaid" ? nextBilling : null,
      },
      { upsert: true, new: true }
    );

    res.redirect("/admin?alertType=success&alertMsg=User+created+successfully");
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a user's subscription status (e.g. Mark Paid, Mark Unpaid, Cancel, Free).
 */
export async function postUpdateSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.redirect("/admin?alertType=error&alertMsg=MongoDB+is+disconnected");
      return;
    }

    const { id } = req.params;
    const { action } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.redirect("/admin?alertType=error&alertMsg=User+not+found");
      return;
    }

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const defaultPlanFee = user.subscriptionPlan === "three_month" ? 299 : 149;

    if (action === "mark_paid") {
      user.subscriptionStatus = "active";
      user.isPremium = true;
      user.monthlyFee = user.monthlyFee || defaultPlanFee;
      user.lastPaymentDate = now;
      user.nextBillingDate = nextMonth;
    } else if (action === "mark_unpaid") {
      user.subscriptionStatus = "unpaid";
      user.isPremium = false;
      user.monthlyFee = user.monthlyFee || defaultPlanFee;
    } else if (action === "set_free") {
      user.subscriptionStatus = "free";
      user.isPremium = false;
      user.monthlyFee = 0;
      user.nextBillingDate = null;
    } else if (action === "cancel") {
      user.subscriptionStatus = "canceled";
      user.isPremium = false;
      user.nextBillingDate = null;
    }

    await user.save();
    res.redirect(`/admin?alertType=success&alertMsg=Updated+subscription+for+${encodeURIComponent(user.email)}`);
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a user profile from the database.
 */
export async function postDeleteUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.redirect("/admin?alertType=error&alertMsg=MongoDB+is+disconnected");
      return;
    }

    const { id } = req.params;
    await User.findByIdAndDelete(id);

    res.redirect("/admin?alertType=success&alertMsg=User+deleted+successfully");
  } catch (err) {
    next(err);
  }
}

/**
 * Seeds realistic demonstration users with a mix of active subscribers, unpaid monthly users,
 * and free users to test and showcase the admin dashboard immediately.
 */
export async function postSeedDemoData(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.redirect("/admin?alertType=error&alertMsg=Cannot+seed:+MongoDB+is+disconnected");
      return;
    }

    const now = new Date();
    const pastTwoWeeks = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const overdueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const demoUsers = [
      {
        name: "Eleanor Vance",
        email: "eleanor.vance@example.com",
        isPremium: true,
        subscriptionStatus: "active" as SubscriptionStatus,
        subscriptionPlan: "monthly",
        monthlyFee: 9.99,
        lastPaymentDate: pastTwoWeeks,
        nextBillingDate: nextMonth,
        isAppAttached: true,
        appAttachedAt: pastTwoWeeks,
        appAttachedPlatform: "iOS / Safari",
        lastQuestionAsked: "When will I meet my soulmate?",
      },
      {
        name: "Marcus Sterling",
        email: "marcus.sterling@example.com",
        isPremium: false,
        subscriptionStatus: "unpaid" as SubscriptionStatus,
        subscriptionPlan: "monthly",
        monthlyFee: 9.99,
        lastPaymentDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        nextBillingDate: overdueDate,
        isAppAttached: false,
      },
      {
        name: "Sophia Luna",
        email: "sophia.luna@cosmic.io",
        isPremium: true,
        subscriptionStatus: "active" as SubscriptionStatus,
        subscriptionPlan: "monthly",
        monthlyFee: 9.99,
        lastPaymentDate: now,
        nextBillingDate: nextMonth,
        isAppAttached: true,
        appAttachedAt: now,
        appAttachedPlatform: "Android / Chrome",
        lastQuestionAsked: "What does Jupiter transit mean for my career in 2026?",
      },
      {
        name: "David Chen",
        email: "david.chen@example.org",
        isPremium: false,
        subscriptionStatus: "unpaid" as SubscriptionStatus,
        subscriptionPlan: "monthly",
        monthlyFee: 14.99,
        lastPaymentDate: null,
        nextBillingDate: overdueDate,
        isAppAttached: false,
      },
      {
        name: "Aria Solstice",
        email: "aria.solstice@starlight.com",
        isPremium: true,
        subscriptionStatus: "active" as SubscriptionStatus,
        subscriptionPlan: "yearly",
        monthlyFee: 7.99,
        lastPaymentDate: pastTwoWeeks,
        nextBillingDate: nextMonth,
        isAppAttached: true,
        appAttachedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        appAttachedPlatform: "Windows / Chrome PWA",
        lastQuestionAsked: "Is this month favorable for starting my business?",
      },
      {
        name: "Jordan Taylor",
        email: "jordan.taylor@freemail.net",
        isPremium: false,
        subscriptionStatus: "free" as SubscriptionStatus,
        subscriptionPlan: "free",
        monthlyFee: 0,
        lastPaymentDate: null,
        nextBillingDate: null,
        isAppAttached: false,
      },
      {
        name: "Liam O'Connor",
        email: "liam.oconnor@domain.co",
        isPremium: false,
        subscriptionStatus: "past_due" as SubscriptionStatus,
        subscriptionPlan: "monthly",
        monthlyFee: 9.99,
        lastPaymentDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        nextBillingDate: overdueDate,
        isAppAttached: false,
      },
      {
        name: "Elena Rostova",
        email: "elena.rostova@celestial.dev",
        isPremium: false,
        subscriptionStatus: "free" as SubscriptionStatus,
        subscriptionPlan: "free",
        monthlyFee: 0,
        lastPaymentDate: null,
        nextBillingDate: null,
        isAppAttached: true,
        appAttachedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        appAttachedPlatform: "macOS / Safari PWA",
        lastQuestionAsked: "Will travel abroad bring positive vitality?",
      },
    ];

    for (const demo of demoUsers) {
      await User.findOneAndUpdate(
        { email: demo.email },
        { $set: demo },
        { upsert: true }
      );

      if (demo.isAppAttached) {
        await AppInstall.create({
          email: demo.email,
          name: demo.name,
          question: demo.lastQuestionAsked || "Astrology query",
          platform: demo.appAttachedPlatform || "Web",
          userAgent: demo.appAttachedPlatform || "Web",
        });
      }
    }

    res.redirect("/admin?alertType=success&alertMsg=Demonstration+users+successfully+seeded!");
  } catch (err) {
    next(err);
  }
}
