import { Request, Response, NextFunction } from "express";
import { DateTime } from "luxon";
import { getTimezoneForCoordinates } from "../services/geoService.js";
import { calculateChart } from "../services/astroService.js";
import { ChartRequestBody, ChartResponse } from "../types/index.js";
import { ChartRecord } from "../models/ChartRecord.js";
import { isDatabaseConnected } from "../config/database.js";
import { buildFullAstrologicalReading } from "../services/openaiService.js";

/**
 * Calculates birth chart and optionally persists to MongoDB when connected.
 */
export async function createChart(
  req: Request<{}, {}, ChartRequestBody>,
  res: Response<ChartResponse | { error: string }>,
  next: NextFunction
): Promise<void> {
  try {
    const { date, time, lat, lon, name, email, place, save } = req.body;

    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      isNaN(lat) ||
      isNaN(lon)
    ) {
      res.status(400).json({ error: "Missing place or invalid coordinates" });
      return;
    }

    if (!date || !time || typeof date !== "string" || typeof time !== "string") {
      res.status(400).json({ error: "Date and time are required" });
      return;
    }

    // Resolve timezone for geographic coordinates
    const tz = getTimezoneForCoordinates(lat, lon);

    // Parse date and time in the local timezone
    const dt = DateTime.fromISO(`${date}T${time}`, { zone: tz });

    if (!dt.isValid) {
      res.status(400).json({ error: "Invalid date or time" });
      return;
    }

    // Calculate birth chart data using UTC time
    const chart = calculateChart(dt.toUTC().toJSDate(), lat, lon);

    const response: ChartResponse = {
      tz,
      ...chart,
    };

    // If MongoDB is connected and persistence is requested or identity provided, save record
    if (isDatabaseConnected() && (save !== false && (name || email || save))) {
      try {
        const record = await ChartRecord.create({
          name: name || "",
          email: email || "",
          date,
          time,
          place: place || "",
          lat,
          lon,
          tz,
          asc: chart.asc,
          planets: chart.planets,
          aspects: chart.aspects,
        });

        response.id = record._id.toString();
        response.saved = true;
      } catch (dbErr) {
        console.warn("⚠️ Failed to persist chart to MongoDB:", dbErr);
        response.saved = false;
      }
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves saved charts from MongoDB with optional email filtering.
 */
export async function getSavedCharts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.status(503).json({
        error: "Database service currently unavailable",
        connected: false,
      });
      return;
    }

    const { email, limit = "20" } = req.query;
    const filter: Record<string, unknown> = {};

    if (email && typeof email === "string") {
      filter.email = email.toLowerCase().trim();
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
    const charts = await ChartRecord.find(filter)
      .sort({ createdAt: -1 })
      .limit(maxLimit)
      .lean();

    res.json({
      count: charts.length,
      charts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single saved chart by MongoDB ObjectId.
 */
export async function getChartById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.status(503).json({ error: "Database service currently unavailable" });
      return;
    }

    const { id } = req.params;
    const chart = await ChartRecord.findById(id).lean();

    if (!chart) {
      res.status(404).json({ error: `Chart record '${id}' not found` });
      return;
    }

    res.json(chart);
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a saved chart by MongoDB ObjectId.
 */
export async function deleteChartById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.status(503).json({ error: "Database service currently unavailable" });
      return;
    }

    const { id } = req.params;
    const deleted = await ChartRecord.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({ error: `Chart record '${id}' not found` });
      return;
    }

    res.json({ success: true, message: `Chart '${id}' deleted successfully` });
  } catch (err) {
    next(err);
  }
}

/**
 * Generates an astrological reading for a querent's question using ChatGPT (OpenAI)
 * with the direct answer appended as the first part of the response.
 */
export async function askChartQuestion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { question, name, chart, customApiKey } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const answer = await buildFullAstrologicalReading({
      question: question.trim(),
      querentName: name && typeof name === "string" ? name.trim() : "Querent",
      chart: chart || {},
      customApiKey: customApiKey && typeof customApiKey === "string" ? customApiKey.trim() : undefined,
    });

    res.json({
      success: true,
      answer,
    });
  } catch (err) {
    next(err);
  }
}
