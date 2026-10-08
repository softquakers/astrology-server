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
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "astrologybuckets",
    folderName: process.env.R2_FOLDER_NAME || "astro-users",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
};
