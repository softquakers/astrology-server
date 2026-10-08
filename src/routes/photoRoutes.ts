import { Router } from "express";
import { uploadPhoto, servePhoto, getPhotoStorageStatus } from "../controllers/photoController.js";

const router = Router();

// GET /api/photos/status - Check Cloudflare R2 storage status and bucket configuration
router.get("/status", getPhotoStorageStatus);

// POST /api/photos/upload - Upload photograph to bucket astrologybuckets / folder astro-users
router.post("/upload", uploadPhoto);

// GET /api/photos/* - Stream photograph directly from Cloudflare R2
router.get("/*", servePhoto);

export default router;
