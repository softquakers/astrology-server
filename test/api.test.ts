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
      const rootJson = (await rootRes.json()) as any;
      if (rootJson.endpoints?.admin !== "/admin") {
        throw new Error("Missing admin endpoint in GET /");
      }
      console.log("✓ Root route verified, admin listed at /admin");

      // 2. EJS Admin Dashboard
      const adminRes = await fetch(`http://localhost:${testPort}/admin`);
      if (adminRes.status !== 200) throw new Error(`GET /admin failed: ${adminRes.status}`);
      const adminHtml = await adminRes.text();
      if (!adminHtml.includes("Astro Reports Admin") || !adminHtml.includes("Signed Up Users")) {
        throw new Error("GET /admin did not render expected EJS dashboard markup");
      }
      console.log("✓ EJS Admin Dashboard rendered successfully");

      // 3. Health check with MongoDB status reporting
      const healthRes = await fetch(`http://localhost:${testPort}/api/health`);
      if (healthRes.status !== 200) throw new Error(`GET /api/health failed: ${healthRes.status}`);
      const healthJson = (await healthRes.json()) as any;
      if (!healthJson.database || typeof healthJson.database.connected !== "boolean") {
        throw new Error("Missing or invalid database diagnostics in /api/health");
      }
      console.log("✓ Health check verified with DB status:", healthJson.database.state);

      // 4. Chart calculation
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

      // 5. Zodiac lookup
      const zodiacRes = await fetch(`http://localhost:${testPort}/api/zodiac/Scorpio`);
      if (zodiacRes.status !== 200) throw new Error(`GET /api/zodiac/Scorpio failed: ${zodiacRes.status}`);

      // 6. Geocoding
      const geoRes = await fetch(`http://localhost:${testPort}/api/geo?q=Paris`);
      if (geoRes.status !== 200) throw new Error(`GET /api/geo failed: ${geoRes.status}`);

      // 7. ChatGPT Astrological Question Answering
      const askRes = await fetch(`http://localhost:${testPort}/api/chart/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "when i get married",
          name: "Rakesh Krishnan",
          chart: chart,
        }),
      });
      if (askRes.status !== 200) throw new Error(`POST /api/chart/ask failed: ${askRes.status}`);
      const askData = (await askRes.json()) as any;
      if (!askData.success || !askData.answer || !askData.answer.aiAnswer) {
        throw new Error("POST /api/chart/ask returned invalid response structure");
      }
      console.log(`✓ ChatGPT AI reading verified: "${askData.answer.aiAnswer.slice(0, 60)}..."`);

      // 8. Test App Screen Attachment recording endpoint
      const attachRes = await fetch(`http://localhost:${testPort}/api/users/attach-screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          question: "When will I get married?",
          platform: "Desktop / Test Browser",
        }),
      });
      if (attachRes.status !== 200) throw new Error(`POST /api/users/attach-screen failed: ${attachRes.status}`);
      const attachData = (await attachRes.json()) as any;
      if (!attachData.success) throw new Error("POST /api/users/attach-screen did not return success");
      console.log("✓ Screen Attachment recording verified:", attachData.message);

      console.log(" All server endpoint, EJS dashboard, and MongoDB-aware tests passed successfully!");
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
