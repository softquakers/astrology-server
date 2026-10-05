import { Request, Response, NextFunction } from "express";
import { searchLocation } from "../services/geoService.js";

export async function getGeoLocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = req.query.q;

    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({ error: "Missing or invalid query parameter 'q'" });
      return;
    }

    const location = await searchLocation(q);

    if (!location) {
      res.status(404).json({ error: "Place not found" });
      return;
    }

    res.json(location);
  } catch (err) {
    next(err);
  }
}
