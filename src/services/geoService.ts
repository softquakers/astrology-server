import { find } from "geo-tz";
import { config } from "../config/index.js";
import { GeoResponse } from "../types/index.js";

// In-memory cache for recent geocoding results to minimize external API calls
const geoCache = new Map<string, GeoResponse>();

/**
 * Searches Nominatim OSM geocoding API for place coordinates and label.
 */
export async function searchLocation(query: string): Promise<GeoResponse | null> {
  const normalized = query.trim().toLowerCase();
  if (geoCache.has(normalized)) {
    return geoCache.get(normalized)!;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": config.userAgent,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding service returned status ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!data || data.length === 0) {
    return null;
  }

  const result: GeoResponse = {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name,
  };

  // Cache up to 200 places
  if (geoCache.size > 200) {
    const firstKey = geoCache.keys().next().value;
    if (firstKey) geoCache.delete(firstKey);
  }
  geoCache.set(normalized, result);

  return result;
}

/**
 * Resolves IANA timezone identifier from geographical coordinates.
 */
export function getTimezoneForCoordinates(lat: number, lon: number): string {
  const timezones = find(lat, lon);
  if (!timezones || timezones.length === 0) {
    return "UTC";
  }
  return timezones[0];
}
