import { createApp } from "./app.js";
import { config } from "./config/index.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`🌌 Astro Express Server running on port ${config.port}`);
  console.log(`📡 Health Check: http://localhost:${config.port}/api/health`);
  console.log(`🧭 Geo API:      http://localhost:${config.port}/api/geo?q=London`);
  console.log(`✨ Chart API:    POST http://localhost:${config.port}/api/chart`);
});

// Graceful shutdown handling
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed. Exiting process.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
