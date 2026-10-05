import { Request, Response } from "express";
import { SIGNS, ZODIAC_METADATA } from "../services/astroService.js";

export function getAllSigns(_req: Request, res: Response): void {
  const signs = SIGNS.map((name) => ZODIAC_METADATA[name]);
  res.json({ signs });
}

export function getSignByName(req: Request, res: Response): void {
  const signParam = Array.isArray(req.params.sign)
    ? req.params.sign[0]
    : req.params.sign || "";
  const normalized =
    signParam.charAt(0).toUpperCase() + signParam.slice(1).toLowerCase();

  const sign = ZODIAC_METADATA[normalized];
  if (!sign) {
    res.status(404).json({ error: `Zodiac sign '${signParam}' not found` });
    return;
  }

  res.json(sign);
}

export function getHoroscope(req: Request, res: Response): void {
  const signParam = Array.isArray(req.params.sign)
    ? req.params.sign[0]
    : req.params.sign || "";
  const normalized =
    signParam.charAt(0).toUpperCase() + signParam.slice(1).toLowerCase();

  const sign = ZODIAC_METADATA[normalized];
  if (!sign) {
    res.status(404).json({ error: `Zodiac sign '${signParam}' not found` });
    return;
  }

  // Daily cosmic forecast
  const themes = [
    "Focus on introspection and setting steady intentions today.",
    "A harmonious alignment invites collaboration and creative inspiration.",
    "Trust your inner guidance when navigating personal or career crossroads.",
    "Opportunities for authentic expression and deep connections are amplified.",
    "Harness patience and mindful presence as subtle shifts begin to unfold.",
  ];

  const hash =
    normalized.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) +
    new Date().getDate();
  const theme = themes[hash % themes.length];

  res.json({
    sign: sign.name,
    date: new Date().toISOString().split("T")[0],
    element: sign.element,
    ruler: sign.ruler,
    forecast: theme,
    luckyAspect: `${sign.element} energy in flow`,
  });
}
