import { Router } from "express";
import {
  getAdminDashboard,
  postCreateUser,
  postUpdateSubscription,
  postDeleteUser,
  postSeedDemoData,
} from "../controllers/adminController.js";
import {
  postSeedFunnel,
  postResetFunnel,
  postSyncFunnel,
} from "../controllers/analyticsController.js";

const router = Router();

// GET /admin - Main Admin Dashboard
router.get("/", getAdminDashboard);

// POST /admin/users - Create User manually
router.post("/users", postCreateUser);

// POST /admin/users/:id/subscription - Change subscription status (mark paid, unpaid, cancel, free)
router.post("/users/:id/subscription", postUpdateSubscription);

// POST /admin/users/:id/delete - Delete a user
router.post("/users/:id/delete", postDeleteUser);

// POST /admin/seed - Seed demo users with varying subscription statuses
router.post("/seed", postSeedDemoData);

// POST /admin/funnel/sync - Synchronize funnel analytics with live database
router.post("/funnel/sync", postSyncFunnel);

// POST /admin/funnel/seed - Seed demo funnel data
router.post("/funnel/seed", postSeedFunnel);

// POST /admin/funnel/reset - Reset funnel events
router.post("/funnel/reset", postResetFunnel);

export default router;
