import mongoose from "mongoose";
import { config } from "./index.js";

const READY_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Initializes and establishes connection to MongoDB using Mongoose.
 * Features a short serverSelectionTimeout so development/testing without a local
 * daemon will not block the Express HTTP server from starting.
 */
export async function connectDatabase(): Promise<boolean> {
  const uri = config.mongodb.uri;

  try {
    // Avoid re-connecting if already connected or connecting
    if (mongoose.connection.readyState === 1) {
      return true;
    }

    mongoose.connection.on("connected", () => {
      console.log(`🌿 MongoDB connected successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
    });

    mongoose.connection.on("error", (err) => {
      console.error("⚠️  MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("ℹ️  MongoDB disconnected.");
    });

    await mongoose.connect(uri, {
      dbName: config.mongodb.dbName,
      serverSelectionTimeoutMS: 4000, // Timeout after 4 seconds if server is not reachable
    });

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  MongoDB initial connection failed: ${errorMsg}`);
    console.warn("ℹ️  Running in database-optional mode. Ensure MONGODB_URI in .env is correct if persistence is required.");
    return false;
  }
}

/**
 * Disconnects from MongoDB gracefully.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Returns whether the MongoDB connection is currently established.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns detailed status of the current MongoDB connection.
 */
export function getDatabaseStatus(): {
  connected: boolean;
  state: string;
  host: string | null;
  name: string | null;
} {
  const stateNumber = mongoose.connection.readyState;
  return {
    connected: stateNumber === 1,
    state: READY_STATES[stateNumber] || "unknown",
    host: stateNumber === 1 ? mongoose.connection.host : null,
    name: stateNumber === 1 ? mongoose.connection.name : null,
  };
}
