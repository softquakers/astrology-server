import { Router } from "express";
import { signUpUser, getUserByEmail, googleAuth, getMe } from "../controllers/userController.js";
import { uploadPhoto } from "../controllers/photoController.js";

const router = Router();

// GET /api/users/me - Verify 30-day session token and return user profile
router.get("/me", getMe);
router.post("/verify-token", getMe);

// POST /api/users/upload-photo - Upload photograph to Cloudflare R2
router.post("/upload-photo", uploadPhoto);
router.post("/photo", uploadPhoto);

// POST /api/users/signup - Sign up / register a user with DOB, photo, name
router.post("/signup", signUpUser);

// POST /api/users/google-auth - Google Sign-In with credential token or profile
router.post("/google-auth", googleAuth);
router.post("/google", googleAuth);

// POST /api/users - Alias for signup
router.post("/", signUpUser);

// GET /api/users/:email - Get user details by email
router.get("/:email", getUserByEmail);

export default router;
