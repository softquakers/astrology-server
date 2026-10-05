import { Router, Request, Response } from "express";
import geoRoutes from "./geoRoutes.js";
import chartRoutes from "./chartRoutes.js";
import zodiacRoutes from "./zodiacRoutes.js";

const apiRouter = Router();

// Health check endpoint
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount resource routers
apiRouter.use("/geo", geoRoutes);
apiRouter.use("/chart", chartRoutes);
apiRouter.use("/zodiac", zodiacRoutes);

export default apiRouter;
