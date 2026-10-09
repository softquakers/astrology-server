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
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    planMonthlyId: process.env.RAZORPAY_PLAN_MONTHLY_ID || "",
    planThreeMonthId: process.env.RAZORPAY_PLAN_THREE_MONTH_ID || "",
    get isConfigured(): boolean {
      return Boolean(this.keyId.trim() && this.keySecret.trim());
    },
  },
  openai: {
    apiKey: (process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || "").trim(),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    get isConfigured(): boolean {
      return Boolean(this.apiKey.trim());
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET || "celestial_astrology_super_secret_jwt_key_2026_30d",
    expiresIn: "30d",
  },
};

