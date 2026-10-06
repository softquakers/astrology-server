import express, { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import morgan from "morgan";
import apiRouter from "./routes/index.js";
import adminRouter from "./routes/adminRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { config } from "./config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // Resolve views folder robustly for both dev (src) and production (dist)
  const localViews = path.resolve(__dirname, "../views");
  const cwdViews = path.resolve(process.cwd(), "views");
  const subfolderViews = path.resolve(process.cwd(), "astrology-server/views");
  const viewsPath = fs.existsSync(localViews)
    ? localViews
    : fs.existsSync(cwdViews)
    ? cwdViews
    : subfolderViews;

  app.set("view engine", "ejs");
  app.set("views", viewsPath);

  // CORS configuration allowing requests from client UI
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // In development or if origin matches clientOrigin / localhost, allow it
        if (
          config.nodeEnv === "development" ||
          origin === config.clientOrigin ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          return callback(null, true);
        }

        return callback(null, true); // Permissive for PWA access
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // Request logging
  app.use(morgan(config.nodeEnv === "development" ? "dev" : "combined"));

  // Body parsing middleware (JSON + URL-encoded forms for EJS)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root welcome / info
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "Astro Reports API Server",
      status: "online",
      version: "1.0.0",
      endpoints: {
        admin: "/admin",
        health: "/api/health",
        signup: "POST /api/users/signup",
        geo: "/api/geo?q={place}",
        chart: "POST /api/chart",
        zodiac: "/api/zodiac",
        horoscope: "/api/zodiac/:sign/horoscope",
      },
    });
  });

  // Mount Admin Dashboard at /admin
  app.use("/admin", adminRouter);

  // Mount API endpoints under /api
  app.use("/api", apiRouter);

  // 404 Not Found fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
