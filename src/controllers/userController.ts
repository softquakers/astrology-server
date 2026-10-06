import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import { isDatabaseConnected } from "../config/database.js";

export interface SignUpRequestBody {
  email: string;
  name?: string;
  photoUrl?: string;
}

/**
 * Signs up or updates a user profile with basic details.
 * Subscription details remain default/free and will be updated later.
 */
export async function signUpUser(
  req: Request<{}, {}, SignUpRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, name, photoUrl } = req.body;

    if (!email || typeof email !== "string" || !email.trim() || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required to sign up" });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanPhoto = typeof photoUrl === "string" ? photoUrl.trim() : "";

    // If database is not connected, provide a graceful fallback response
    if (!isDatabaseConnected()) {
      res.status(200).json({
        success: true,
        offline: true,
        message: "Sign up noted in offline mode; database currently disconnected",
        user: {
          email: cleanEmail,
          name: cleanName,
          photoUrl: cleanPhoto,
          subscriptionStatus: "free",
          subscriptionPlan: "free",
          isPremium: false,
        },
      });
      return;
    }

    // Find existing user or create a new one
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = await User.create({
        email: cleanEmail,
        name: cleanName,
        photoUrl: cleanPhoto,
        subscriptionStatus: "free",
        subscriptionPlan: "free",
        monthlyFee: 0,
        isPremium: false,
      });
    } else {
      // Update name and photoUrl if new information is provided
      let modified = false;
      if (cleanName && user.name !== cleanName) {
        user.name = cleanName;
        modified = true;
      }
      if (cleanPhoto && user.photoUrl !== cleanPhoto) {
        user.photoUrl = cleanPhoto;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "User signed up successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        isPremium: user.isPremium,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a user profile by email address.
 */
export async function getUserByEmail(
  req: Request<{ email: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isDatabaseConnected()) {
      res.status(503).json({ error: "Database service currently unavailable" });
      return;
    }

    const { email } = req.params;
    if (!email) {
      res.status(400).json({ error: "Email parameter is required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();

    if (!user) {
      res.status(404).json({ error: `User with email '${email}' not found` });
      return;
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
}
