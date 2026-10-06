import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  userAgent: process.env.USER_AGENT || "astro-pwa-server/1.0",
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/astrology_db",
    dbName: process.env.MONGODB_DB_NAME || "astrologydb",
  },
};
