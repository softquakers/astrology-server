# Astro Reports Express Server

A modular, TypeScript-powered Express backend application built to support the **Astro PWA** client UI.

## Features

- **Ephemeris Calculations**: Calculates high-precision planetary longitudes (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) using `astronomy-engine`.
- **Whole Sign Houses & Ascendant**: Determines the exact Ascendant degree and houses based on RAMC (Right Ascension of the Midheaven) and geographic coordinates.
- **Aspect Analysis**: Detects astrological aspects (conjunction, sextile, square, trine, opposition) with configurable 6° orbs.
- **Geocoding & Caching**: Reverse geocodes place queries using OpenStreetMap Nominatim with in-memory caching to avoid rate limits.
- **Timezone Detection**: Automatically identifies geographic IANA timezones using `geo-tz` and `luxon`.
- **Zodiac & Horoscope APIs**: Includes metadata for all 12 astrological signs and daily horoscope forecasts.
- **CORS & Security**: Configured with CORS for seamless client communication from `http://localhost:3000`.

---

## Directory Structure

```text
server/
├── src/
│   ├── index.ts                # Application entrypoint & HTTP server
│   ├── app.ts                  # Express application setup & middleware
│   ├── config/
│   │   └── index.ts            # Environment and application configuration
│   ├── controllers/
│   │   ├── chartController.ts  # Handles POST /api/chart
│   │   ├── geoController.ts    # Handles GET /api/geo
│   │   └── zodiacController.ts # Handles /api/zodiac and horoscopes
│   ├── routes/
│   │   ├── index.ts            # Main API router aggregation
│   │   ├── chartRoutes.ts      # Chart route definition
│   │   ├── geoRoutes.ts        # Geo route definition
│   │   └── zodiacRoutes.ts     # Zodiac and horoscope routes
│   ├── services/
│   │   ├── astroService.ts     # Ephemeris & astronomical algorithms
│   │   └── geoService.ts       # Nominatim geocoding & timezone detection
│   ├── middleware/
│   │   ├── errorHandler.ts     # Centralized error handler
│   │   └── requestLogger.ts    # Request logging
│   └── types/
│       └── index.ts            # TypeScript interfaces & types
├── test/
│   └── api.test.ts             # Automated integration tests
├── .env.example
├── package.json
└── tsconfig.json
```

---

## API Endpoints

### 1. Health Check
- **`GET /api/health`**
- **Response**:
  ```json
  {
    "status": "ok",
    "uptime": 12.34,
    "timestamp": "2026-10-03T07:30:00.000Z"
  }
  ```

### 2. Geocoding
- **`GET /api/geo?q={place}`**
- **Query Params**: `q` (string, required) - City or place name (e.g., `Paris`, `London`, `Tokyo`)
- **Response**:
  ```json
  {
    "lat": 48.8534951,
    "lon": 2.3483915,
    "label": "Paris, Île-de-France, France métropolitaine, France"
  }
  ```

### 3. Birth Chart Calculation
- **`POST /api/chart`**
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "date": "1995-10-25",
    "time": "14:30",
    "lat": 51.5074,
    "lon": -0.1278
  }
  ```
- **Response**:
  ```json
  {
    "tz": "Europe/London",
    "asc": "Aquarius 18.23°",
    "planets": [
      { "name": "Sun", "lon": 211.85, "sign": "Scorpio", "deg": 1.85, "house": 10 },
      { "name": "Moon", "lon": 224.12, "sign": "Scorpio", "deg": 14.12, "house": 10 },
      { "name": "Mercury", "lon": 204.60, "sign": "Libra", "deg": 24.60, "house": 9 },
      { "name": "Venus", "lon": 232.41, "sign": "Scorpio", "deg": 22.41, "house": 10 },
      { "name": "Mars", "lon": 248.91, "sign": "Sagittarius", "deg": 8.91, "house": 11 },
      { "name": "Jupiter", "lon": 254.30, "sign": "Sagittarius", "deg": 14.30, "house": 11 },
      { "name": "Saturn", "lon": 349.52, "sign": "Pisces", "deg": 19.52, "house": 2 }
    ],
    "aspects": [
      "Sun conjunction Moon",
      "Mars conjunction Jupiter"
    ]
  }
  ```

### 4. Zodiac Information
- **`GET /api/zodiac`**: Returns metadata for all 12 zodiac signs.
- **`GET /api/zodiac/:sign`**: Returns details for a specific sign (e.g., `/api/zodiac/Scorpio`).
- **`GET /api/zodiac/:sign/horoscope`**: Returns daily horoscope forecast for a specific sign.

---

## Getting Started

### 1. Installation
```bash
cd server
npm install
```

### 2. Development Mode
Runs the server with auto-reloading using `tsx watch`:
```bash
npm run dev
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Production Build & Start
```bash
npm run build
npm start
```

---

## Environment Variables

Configure via `.env`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port on which the Express server listens |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for the Next.js client |
