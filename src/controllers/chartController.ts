import { Request, Response, NextFunction } from "express";
import { DateTime } from "luxon";
import { getTimezoneForCoordinates } from "../services/geoService.js";
import { calculateChart } from "../services/astroService.js";
import { ChartRequestBody, ChartResponse } from "../types/index.js";

export async function createChart(
  req: Request<{}, {}, ChartRequestBody>,
  res: Response<ChartResponse | { error: string }>,
  next: NextFunction
): Promise<void> {
  try {
    const { date, time, lat, lon } = req.body;

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

    res.json({
      tz,
      ...chart,
    });
  } catch (err) {
    next(err);
  }
}
