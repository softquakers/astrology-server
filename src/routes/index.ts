import { Router, Request, Response } from "express";
import geoRoutes from "./geoRoutes.js";
import chartRoutes from "./chartRoutes.js";
import zodiacRoutes from "./zodiacRoutes.js";
import userRoutes from "./userRoutes.js";
import photoRoutes from "./photoRoutes.js";
import subscriptionRoutes from "./subscriptionRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import { getDatabaseStatus } from "../config/database.js";

const apiRouter = Router();

// Health check endpoint with database diagnostics
apiRouter.get("/health", (_req: Request, res: Response) => {
  const database = getDatabaseStatus();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database,
  });
});

// Mount resource routers
apiRouter.use("/geo", geoRoutes);
apiRouter.use("/chart", chartRoutes);
apiRouter.use("/zodiac", zodiacRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/photos", photoRoutes);
apiRouter.use("/subscriptions", subscriptionRoutes);
apiRouter.use("/analytics", analyticsRoutes);
apiRouter.use("/funnel", analyticsRoutes);

export default apiRouter;

