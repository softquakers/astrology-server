import { Router } from "express";
import { signUpUser, getUserByEmail, googleAuth } from "../controllers/userController.js";

const router = Router();

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
