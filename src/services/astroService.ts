import { Body, GeoVector, Ecliptic, MakeTime, SiderealTime } from "astronomy-engine";
import { ChartData, PlanetPosition, ZodiacSignInfo } from "../types/index.js";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

const PLANET_NAMES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
] as const;

const ASPECTS: [string, number][] = [
  ["conjunction", 0],
  ["sextile", 60],
  ["square", 90],
  ["trine", 120],
  ["opposition", 180],
];

const rad = (d: number): number => (d * Math.PI) / 180;
const norm = (d: number): number => ((d % 360) + 360) % 360;

/**
 * Calculates birth chart positions, Whole Sign houses, Ascendant, and planetary aspects
 * using high-precision ephemeris algorithms from astronomy-engine.
 */
export function calculateChart(utc: Date, lat: number, lon: number): ChartData {
  const t = MakeTime(utc);

  // Calculate geocentric ecliptic longitudes of date for the 7 classical planets
  const raw = PLANET_NAMES.map((n) => ({
    name: n,
    lon: norm(Ecliptic(GeoVector(Body[n], t, true)).elon),
  }));

  // Right Ascension of the Medium Coeli (RAMC) and mean obliquity of ecliptic
  const ramc = norm(SiderealTime(t) * 15 + lon);
  const eps = 23.4393;

  // Ascendant angle in tropical degrees
  const asc = norm(
    (Math.atan2(
      Math.cos(rad(ramc)),
      -(
        Math.sin(rad(ramc)) * Math.cos(rad(eps)) +
        Math.tan(rad(lat)) * Math.sin(rad(eps))
      )
    ) *
      180) /
      Math.PI
  );

  const ascSign = Math.floor(asc / 30);

  // Assign Whole Sign houses based on Ascendant sign
  const planets: PlanetPosition[] = raw.map((p) => {
    const planetSignIndex = Math.floor(p.lon / 30);
    const house = ((planetSignIndex - ascSign + 12) % 12) + 1;
    return {
      name: p.name,
      lon: p.lon,
      sign: SIGNS[planetSignIndex],
      deg: +(p.lon % 30).toFixed(2),
      house,
    };
  });

  // Calculate planetary aspects within an orb of 6 degrees
  const aspects: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) {
      const diff = Math.abs(raw[i].lon - raw[j].lon);
      const angle = diff > 180 ? 360 - diff : diff;
      for (const [name, targetVal] of ASPECTS) {
        if (Math.abs(angle - targetVal) <= 6) {
          aspects.push(`${raw[i].name} ${name} ${raw[j].name}`);
        }
      }
    }
  }

  const ascText = `${SIGNS[ascSign]} ${(asc % 30).toFixed(2)}°`;

  return {
    asc: ascText,
    planets,
    aspects,
  };
}

export const ZODIAC_METADATA: Record<string, ZodiacSignInfo> = {
  Aries: {
    name: "Aries",
    symbol: "♈",
    element: "Fire",
    modality: "Cardinal",
    ruler: "Mars",
    dates: "Mar 21 - Apr 19",
    keywords: ["Bold", "Pioneering", "Courageous", "Dynamic"],
  },
  Taurus: {
    name: "Taurus",
    symbol: "♉",
    element: "Earth",
    modality: "Fixed",
    ruler: "Venus",
    dates: "Apr 20 - May 20",
    keywords: ["Grounded", "Reliable", "Patient", "Sensual"],
  },
  Gemini: {
    name: "Gemini",
    symbol: "♊",
    element: "Air",
    modality: "Mutable",
    ruler: "Mercury",
    dates: "May 21 - Jun 20",
    keywords: ["Curious", "Adaptable", "Communicative", "Witty"],
  },
  Cancer: {
    name: "Cancer",
    symbol: "♋",
    element: "Water",
    modality: "Cardinal",
    ruler: "Moon",
    dates: "Jun 21 - Jul 22",
    keywords: ["Intuitive", "Nurturing", "Protective", "Empathetic"],
  },
  Leo: {
    name: "Leo",
    symbol: "♌",
    element: "Fire",
    modality: "Fixed",
    ruler: "Sun",
    dates: "Jul 23 - Aug 22",
    keywords: ["Radiant", "Charismatic", "Generous", "Creative"],
  },
  Virgo: {
    name: "Virgo",
    symbol: "♍",
    element: "Earth",
    modality: "Mutable",
    ruler: "Mercury",
    dates: "Aug 23 - Sep 22",
    keywords: ["Analytical", "Meticulous", "Helpful", "Practical"],
  },
  Libra: {
    name: "Libra",
    symbol: "♎",
    element: "Air",
    modality: "Cardinal",
    ruler: "Venus",
    dates: "Sep 23 - Oct 22",
    keywords: ["Harmonious", "Diplomatic", "Fair", "Artistic"],
  },
  Scorpio: {
    name: "Scorpio",
    symbol: "♏",
    element: "Water",
    modality: "Fixed",
    ruler: "Mars / Pluto",
    dates: "Oct 23 - Nov 21",
    keywords: ["Transformative", "Passionate", "Perceptive", "Resilient"],
  },
  Sagittarius: {
    name: "Sagittarius",
    symbol: "♐",
    element: "Fire",
    modality: "Mutable",
    ruler: "Jupiter",
    dates: "Nov 22 - Dec 21",
    keywords: ["Philosophical", "Adventurous", "Optimistic", "Free-spirited"],
  },
  Capricorn: {
    name: "Capricorn",
    symbol: "♑",
    element: "Earth",
    modality: "Cardinal",
    ruler: "Saturn",
    dates: "Dec 22 - Jan 19",
    keywords: ["Disciplined", "Ambitious", "Strategic", "Enduring"],
  },
  Aquarius: {
    name: "Aquarius",
    symbol: "♒",
    element: "Air",
    modality: "Fixed",
    ruler: "Saturn / Uranus",
    dates: "Jan 20 - Feb 18",
    keywords: ["Visionary", "Humanitarian", "Original", "Independent"],
  },
  Pisces: {
    name: "Pisces",
    symbol: "♓",
    element: "Water",
    modality: "Mutable",
    ruler: "Jupiter / Neptune",
    dates: "Feb 19 - Mar 20",
    keywords: ["Compassionate", "Mystical", "Imaginative", "Dreamer"],
  },
};
