import { createApp } from "../src/app.js";

async function runTests() {
  const app = createApp();
  const testPort = 5199;
  const server = app.listen(testPort, async () => {
    try {
      console.log(`Running tests against test server on port ${testPort}...`);

      // 1. Root route
      const rootRes = await fetch(`http://localhost:${testPort}/`);
      if (rootRes.status !== 200) throw new Error(`GET / failed: ${rootRes.status}`);

      // 2. Health check with MongoDB status reporting
      const healthRes = await fetch(`http://localhost:${testPort}/api/health`);
      if (healthRes.status !== 200) throw new Error(`GET /api/health failed: ${healthRes.status}`);
      const healthJson = (await healthRes.json()) as any;
      if (!healthJson.database || typeof healthJson.database.connected !== "boolean") {
        throw new Error("Missing or invalid database diagnostics in /api/health");
      }
      console.log("✓ Health check verified with DB status:", healthJson.database.state);

      // 3. Chart calculation
      const chartRes = await fetch(`http://localhost:${testPort}/api/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          email: "test@example.com",
          date: "1995-10-25",
          time: "14:30",
          lat: 51.5074,
          lon: -0.1278,
        }),
      });
      if (chartRes.status !== 200) throw new Error(`POST /api/chart failed: ${chartRes.status}`);
      const chart = (await chartRes.json()) as any;
      if (!chart.tz || !chart.asc || !chart.planets || !chart.aspects) {
        throw new Error("Invalid chart response structure");
      }
      console.log("✓ Chart calculation verified:", chart.asc, `(tz: ${chart.tz})`);

      // 4. Zodiac lookup
      const zodiacRes = await fetch(`http://localhost:${testPort}/api/zodiac/Scorpio`);
      if (zodiacRes.status !== 200) throw new Error(`GET /api/zodiac/Scorpio failed: ${zodiacRes.status}`);

      // 5. Geocoding
      const geoRes = await fetch(`http://localhost:${testPort}/api/geo?q=Paris`);
      if (geoRes.status !== 200) throw new Error(`GET /api/geo failed: ${geoRes.status}`);

      console.log(" All server endpoint and MongoDB-aware tests passed successfully!");
      process.exit(0);
    } catch (err) {
      console.error("Test failure:", err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

runTests();
