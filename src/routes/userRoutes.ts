import { Router } from "express";
import { signUpUser, getUserByEmail } from "../controllers/userController.js";

const router = Router();

// POST /api/users/signup - Sign up / register a user
router.post("/signup", signUpUser);

// POST /api/users - Alias for signup
router.post("/", signUpUser);

// GET /api/users/:email - Get user details by email
router.get("/:email", getUserByEmail);

export default router;
