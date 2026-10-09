import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export interface TokenPayload {
  userId?: string;
  email: string;
  name?: string;
  isPremium?: boolean;
}

/**
 * Generates a signed JWT session token valid for 30 days (1 month).
 */
export function signUserToken(payload: TokenPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || "",
      isPremium: Boolean(payload.isPremium),
    },
    config.jwt.secret,
    {
      expiresIn: "30d", // 30 days = 1 month
    }
  );
}

/**
 * Verifies and decodes a user session JWT token.
 * Returns decoded payload if valid and within 30-day window, or null if expired/invalid.
 */
export function verifyUserToken(token: string): (TokenPayload & { exp?: number; iat?: number }) | null {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload & { exp?: number; iat?: number };
  } catch {
    return null;
  }
}
