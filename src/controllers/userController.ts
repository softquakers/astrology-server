import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import { isDatabaseConnected } from "../config/database.js";
import { uploadPhotographToR2, isBase64Image } from "../services/r2Service.js";
import { signUserToken, verifyUserToken } from "../services/authService.js";

export interface SignUpRequestBody {
  email: string;
  name?: string;
  photoUrl?: string;
  dob?: string;
  birthTime?: string;
  birthPlace?: string;
  googleId?: string;
  googleAuthBday?: string;
}

export interface GoogleAuthRequestBody {
  credential?: string;
  email?: string;
  name?: string;
  photoUrl?: string;
  dob?: string;
  birthTime?: string;
  birthPlace?: string;
  googleAuthBday?: string;
  birthday?: string;
  birthdate?: string;
}

/**
 * Safely decodes a Google JWT credential without external crypto dependency.
 */
function decodeGoogleJwt(token: string): {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  birthdate?: string;
  birthday?: string;
} | null {
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
    const { email, name, photoUrl, dob, birthTime, birthPlace, googleId, googleAuthBday } = req.body;

    if (!email || typeof email !== "string" || !email.trim() || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required to sign up" });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = typeof name === "string" ? name.trim() : "";
    let cleanPhoto = typeof photoUrl === "string" ? photoUrl.trim() : "";
    if (cleanPhoto && isBase64Image(cleanPhoto)) {
      try {
        const uploadResult = await uploadPhotographToR2({
          data: cleanPhoto,
          userEmail: cleanEmail,
        });
        if (uploadResult && uploadResult.url) {
          cleanPhoto = uploadResult.url;
        }
      } catch (uploadErr) {
        console.warn("[Cloudflare R2] Photo upload error in signUpUser:", uploadErr);
      }
    }
    const cleanDob = typeof dob === "string" ? dob.trim() : "";
    const cleanBirthTime = typeof birthTime === "string" ? birthTime.trim() : "";
    const cleanBirthPlace = typeof birthPlace === "string" ? birthPlace.trim() : "";
    const cleanGoogleId = typeof googleId === "string" ? googleId.trim() : "";
    const cleanGoogleAuthBday = typeof googleAuthBday === "string" ? googleAuthBday.trim() : "";

    // If database is not connected, provide a graceful fallback response
    if (!isDatabaseConnected()) {
      const token = signUserToken({
        email: cleanEmail,
        name: cleanName,
        isPremium: false,
      });
      res.status(200).json({
        success: true,
        offline: true,
        token,
        message: "Sign up noted in offline mode; database currently disconnected",
        user: {
          email: cleanEmail,
          name: cleanName,
          photoUrl: cleanPhoto,
          dob: cleanDob,
          birthTime: cleanBirthTime,
          birthPlace: cleanBirthPlace,
          googleAuthBday: cleanGoogleAuthBday,
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
        googleAuthBday: cleanGoogleAuthBday,
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
      if (cleanGoogleAuthBday && user.googleAuthBday !== cleanGoogleAuthBday) {
        user.googleAuthBday = cleanGoogleAuthBday;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    const token = signUserToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isPremium: user.isPremium,
    });

    res.status(200).json({
      success: true,
      token,
      message: "User signed up successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        dob: user.dob,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
        googleAuthBday: user.googleAuthBday,
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
    const { credential, email, name, photoUrl, dob, birthTime, birthPlace, googleAuthBday, birthday, birthdate } = req.body;

    let targetEmail = email;
    let targetName = name;
    let targetPhoto = photoUrl;
    let targetGoogleId = "";
    let targetGoogleBday = googleAuthBday || birthday || birthdate || "";

    // Parse Google JWT if provided
    if (credential && typeof credential === "string") {
      const decoded = decodeGoogleJwt(credential);
      if (decoded) {
        if (decoded.email) targetEmail = decoded.email;
        if (decoded.name) targetName = decoded.name;
        if (decoded.picture) targetPhoto = decoded.picture;
        if (decoded.sub) targetGoogleId = decoded.sub;
        if (decoded.birthdate && !targetGoogleBday) targetGoogleBday = decoded.birthdate;
        if (decoded.birthday && !targetGoogleBday) targetGoogleBday = decoded.birthday;
      }
    }

    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      res.status(400).json({ error: "Invalid Google authentication: missing valid email" });
      return;
    }

    const cleanEmail = targetEmail.toLowerCase().trim();
    const cleanName = typeof targetName === "string" ? targetName.trim() : "";
    let cleanPhoto = typeof targetPhoto === "string" ? targetPhoto.trim() : "";
    if (cleanPhoto && isBase64Image(cleanPhoto)) {
      try {
        const uploadResult = await uploadPhotographToR2({
          data: cleanPhoto,
          userEmail: cleanEmail,
        });
        if (uploadResult && uploadResult.url) {
          cleanPhoto = uploadResult.url;
        }
      } catch (uploadErr) {
        console.warn("[Cloudflare R2] Photo upload error in googleAuth:", uploadErr);
      }
    }
    const cleanDob = typeof dob === "string" ? dob.trim() : "";
    const cleanBirthTime = typeof birthTime === "string" ? birthTime.trim() : "";
    const cleanBirthPlace = typeof birthPlace === "string" ? birthPlace.trim() : "";
    const cleanGoogleAuthBday = typeof targetGoogleBday === "string" ? targetGoogleBday.trim() : "";

    if (!isDatabaseConnected()) {
      const token = signUserToken({
        email: cleanEmail,
        name: cleanName,
        isPremium: false,
      });
      res.status(200).json({
        success: true,
        offline: true,
        token,
        message: "Google sign in noted (offline mode)",
        user: {
          email: cleanEmail,
          name: cleanName,
          photoUrl: cleanPhoto,
          dob: cleanDob,
          birthTime: cleanBirthTime,
          birthPlace: cleanBirthPlace,
          googleAuthBday: cleanGoogleAuthBday,
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
        googleAuthBday: cleanGoogleAuthBday,
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
      if (cleanGoogleAuthBday && user.googleAuthBday !== cleanGoogleAuthBday) {
        user.googleAuthBday = cleanGoogleAuthBday;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    const token = signUserToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isPremium: user.isPremium,
    });

    res.status(200).json({
      success: true,
      token,
      message: "Google sign-in successful",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        dob: user.dob,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
        googleAuthBday: user.googleAuthBday,
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
      googleAuthBday: (user as any).googleAuthBday || "",
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Validates a 30-day JWT session token and returns current user details.
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.body && req.body.token) {
      token = String(req.body.token).trim();
    } else if (req.query && req.query.token) {
      token = String(req.query.token).trim();
    }

    if (!token) {
      res.status(401).json({ success: false, error: "No session token provided" });
      return;
    }

    const payload = verifyUserToken(token);
    if (!payload || !payload.email) {
      res.status(401).json({ success: false, error: "Session token is invalid or expired" });
      return;
    }

    if (!isDatabaseConnected()) {
      res.status(200).json({
        success: true,
        valid: true,
        token,
        user: {
          email: payload.email,
          name: payload.name || "",
          isPremium: Boolean(payload.isPremium),
        },
      });
      return;
    }

    const user = await User.findOne({ email: payload.email.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ success: false, error: "User account not found" });
      return;
    }

    // Refresh token with latest user details if valid
    const refreshedToken = signUserToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isPremium: user.isPremium,
    });

    res.status(200).json({
      success: true,
      valid: true,
      token: refreshedToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        dob: user.dob,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
        googleAuthBday: user.googleAuthBday,
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
