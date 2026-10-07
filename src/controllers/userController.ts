import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import { isDatabaseConnected } from "../config/database.js";

export interface SignUpRequestBody {
  email: string;
  name?: string;
  photoUrl?: string;
  dob?: string;
  birthTime?: string;
  birthPlace?: string;
  googleId?: string;
}

export interface GoogleAuthRequestBody {
  credential?: string;
  email?: string;
  name?: string;
  photoUrl?: string;
  dob?: string;
  birthTime?: string;
  birthPlace?: string;
}

/**
 * Safely decodes a Google JWT credential without external crypto dependency.
 */
function decodeGoogleJwt(token: string): { email?: string; name?: string; picture?: string; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Signs up or updates a user profile with personal and birth details.
 * Subscription details remain default/free and will be added later.
 */
export async function signUpUser(
  req: Request<{}, {}, SignUpRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, name, photoUrl, dob, birthTime, birthPlace, googleId } = req.body;

    if (!email || typeof email !== "string" || !email.trim() || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required to sign up" });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanPhoto = typeof photoUrl === "string" ? photoUrl.trim() : "";
    const cleanDob = typeof dob === "string" ? dob.trim() : "";
    const cleanBirthTime = typeof birthTime === "string" ? birthTime.trim() : "";
    const cleanBirthPlace = typeof birthPlace === "string" ? birthPlace.trim() : "";
    const cleanGoogleId = typeof googleId === "string" ? googleId.trim() : "";

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
          dob: cleanDob,
          birthTime: cleanBirthTime,
          birthPlace: cleanBirthPlace,
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
        dob: cleanDob,
        birthTime: cleanBirthTime,
        birthPlace: cleanBirthPlace,
        googleId: cleanGoogleId,
        subscriptionStatus: "free",
        subscriptionPlan: "free",
        monthlyFee: 0,
        isPremium: false,
      });
    } else {
      // Update name, photo, and birth details if new information is provided
      let modified = false;
      if (cleanName && user.name !== cleanName) {
        user.name = cleanName;
        modified = true;
      }
      if (cleanPhoto && user.photoUrl !== cleanPhoto) {
        user.photoUrl = cleanPhoto;
        modified = true;
      }
      if (cleanDob && user.dob !== cleanDob) {
        user.dob = cleanDob;
        modified = true;
      }
      if (cleanBirthTime && user.birthTime !== cleanBirthTime) {
        user.birthTime = cleanBirthTime;
        modified = true;
      }
      if (cleanBirthPlace && user.birthPlace !== cleanBirthPlace) {
        user.birthPlace = cleanBirthPlace;
        modified = true;
      }
      if (cleanGoogleId && user.googleId !== cleanGoogleId) {
        user.googleId = cleanGoogleId;
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
        dob: user.dob,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
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
 * Handles Google Sign-In with either a Google Credential JWT or direct profile attributes.
 */
export async function googleAuth(
  req: Request<{}, {}, GoogleAuthRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { credential, email, name, photoUrl, dob, birthTime, birthPlace } = req.body;

    let targetEmail = email;
    let targetName = name;
    let targetPhoto = photoUrl;
    let targetGoogleId = "";

    // Parse Google JWT if provided
    if (credential && typeof credential === "string") {
      const decoded = decodeGoogleJwt(credential);
      if (decoded) {
        if (decoded.email) targetEmail = decoded.email;
        if (decoded.name) targetName = decoded.name;
        if (decoded.picture) targetPhoto = decoded.picture;
        if (decoded.sub) targetGoogleId = decoded.sub;
      }
    }

    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      res.status(400).json({ error: "Invalid Google authentication: missing valid email" });
      return;
    }

    const cleanEmail = targetEmail.toLowerCase().trim();
    const cleanName = typeof targetName === "string" ? targetName.trim() : "";
    const cleanPhoto = typeof targetPhoto === "string" ? targetPhoto.trim() : "";
    const cleanDob = typeof dob === "string" ? dob.trim() : "";
    const cleanBirthTime = typeof birthTime === "string" ? birthTime.trim() : "";
    const cleanBirthPlace = typeof birthPlace === "string" ? birthPlace.trim() : "";

    if (!isDatabaseConnected()) {
      res.status(200).json({
        success: true,
        offline: true,
        message: "Google sign in noted (offline mode)",
        user: {
          email: cleanEmail,
          name: cleanName,
          photoUrl: cleanPhoto,
          dob: cleanDob,
          birthTime: cleanBirthTime,
          birthPlace: cleanBirthPlace,
          subscriptionStatus: "free",
          subscriptionPlan: "free",
          isPremium: false,
        },
      });
      return;
    }

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = await User.create({
        email: cleanEmail,
        name: cleanName,
        photoUrl: cleanPhoto,
        dob: cleanDob,
        birthTime: cleanBirthTime,
        birthPlace: cleanBirthPlace,
        googleId: targetGoogleId,
        subscriptionStatus: "free",
        subscriptionPlan: "free",
        monthlyFee: 0,
        isPremium: false,
      });
    } else {
      let modified = false;
      if (cleanName && (!user.name || user.name !== cleanName)) {
        user.name = cleanName;
        modified = true;
      }
      if (cleanPhoto && (!user.photoUrl || user.photoUrl !== cleanPhoto)) {
        user.photoUrl = cleanPhoto;
        modified = true;
      }
      if (cleanDob && user.dob !== cleanDob) {
        user.dob = cleanDob;
        modified = true;
      }
      if (cleanBirthTime && user.birthTime !== cleanBirthTime) {
        user.birthTime = cleanBirthTime;
        modified = true;
      }
      if (cleanBirthPlace && user.birthPlace !== cleanBirthPlace) {
        user.birthPlace = cleanBirthPlace;
        modified = true;
      }
      if (targetGoogleId && user.googleId !== targetGoogleId) {
        user.googleId = targetGoogleId;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Google sign-in successful",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        dob: user.dob,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
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
      dob: user.dob,
      birthTime: user.birthTime,
      birthPlace: user.birthPlace,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
}
