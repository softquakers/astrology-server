import { Request, Response, NextFunction } from "express";
import { uploadPhotographToR2, getPhotoFromR2, isBase64Image, getR2Diagnostics } from "../services/r2Service.js";

/**
 * Upload a photograph to Cloudflare R2 bucket astrologybuckets under folder astro-users
 * POST /api/photos/upload or POST /api/users/upload-photo
 */
export async function uploadPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const photoData = req.body.photo || req.body.image || req.body.photoUrl;
    const email = req.body.email;

    if (!photoData || typeof photoData !== "string") {
      res.status(400).json({
        error: "Missing photo payload. Please provide a base64 encoded photo or image data URL.",
      });
      return;
    }

    if (!isBase64Image(photoData)) {
      res.status(400).json({
        error: "Invalid photo format. Expected base64 image string or data URL.",
      });
      return;
    }

    const result = await uploadPhotographToR2({
      data: photoData,
      userEmail: typeof email === "string" ? email.trim() : undefined,
    });

    res.status(200).json({
      success: true,
      message: result.offlineFallback
        ? "Photo received (R2 credentials pending in .env)"
        : "Photograph successfully uploaded to Cloudflare R2",
      photoUrl: result.url,
      key: result.key,
      bucket: result.bucket,
      folder: result.folder,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    });
  } catch (err: any) {
    console.error("Photo upload error:", err);
    res.status(500).json({
      error: "Failed to upload photo to storage",
      details: err?.message || String(err),
    });
  }
}

/**
 * Proxy stream photo from Cloudflare R2
 * GET /api/photos/*
 */
export async function servePhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract key from wildcards e.g. /api/photos/astro-users/abc.jpg -> "astro-users/abc.jpg"
    const rawKey = req.params[0] || (req.params as any).key;

    if (!rawKey) {
      res.status(400).json({ error: "Object key parameter is required" });
      return;
    }

    const cleanKey = decodeURIComponent(rawKey).replace(/^\/+/, "");

    const r2Object = await getPhotoFromR2(cleanKey);

    if (!r2Object || !r2Object.Body) {
      res.status(404).json({ error: "Photo not found in storage" });
      return;
    }

    if (r2Object.ContentType) {
      res.setHeader("Content-Type", r2Object.ContentType);
    }
    if (r2Object.ContentLength) {
      res.setHeader("Content-Length", r2Object.ContentLength);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // AWS SDK v3 stream response
    const stream = r2Object.Body as any;
    if (typeof stream.pipe === "function") {
      stream.pipe(res);
    } else if (typeof stream.transformToByteArray === "function") {
      const bytes = await stream.transformToByteArray();
      res.end(Buffer.from(bytes));
    } else {
      res.status(500).json({ error: "Unable to stream photo body" });
    }
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: "Photograph not found in storage bucket" });
      return;
    }
    console.error("Failed to serve photo from R2:", err);
    res.status(500).json({
      error: "Could not retrieve photograph from storage",
      details: err?.message || String(err),
    });
  }
}

/**
 * Storage diagnostics and status
 * GET /api/photos/status
 */
export async function getPhotoStorageStatus(
  _req: Request,
  res: Response
): Promise<void> {
  const diagnostics = getR2Diagnostics();
  res.json({
    status: diagnostics.configured ? "connected" : "credentials_needed",
    service: "Cloudflare R2 Object Storage",
    ...diagnostics,
  });
}
