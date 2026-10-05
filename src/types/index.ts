export interface PlanetPosition {
  name: string;
  lon: number;
  sign: string;
  deg: number;
  house: number;
}

export interface ChartData {
  asc: string;
  planets: PlanetPosition[];
  aspects: string[];
}

export interface ChartResponse extends ChartData {
  tz: string;
}

export interface ChartRequestBody {
  date: string;
  time: string;
  lat: number;
  lon: number;
}

export interface GeoResponse {
  lat: number;
  lon: number;
  label: string;
}

export interface ZodiacSignInfo {
  name: string;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  modality: "Cardinal" | "Fixed" | "Mutable";
  ruler: string;
  dates: string;
  keywords: string[];
}
