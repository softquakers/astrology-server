import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { config } from "../config/index.js";

let s3ClientInstance: S3Client | null = null;

/**
 * Check whether Cloudflare R2 credentials have been provided in environment variables
 */
export function isR2Configured(): boolean {
  return Boolean(
    config.r2.accountId &&
    config.r2.accessKeyId &&
    config.r2.secretAccessKey
  );
}

/**
 * Returns a singleton instance of S3Client configured for Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not fully configured. Please provide R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env"
    );
  }

  // Cloudflare R2 S3-compatible endpoint format:
  // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  const endpoint = `https://${config.r2.accountId.trim()}.r2.cloudflarestorage.com`;

  s3ClientInstance = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId.trim(),
      secretAccessKey: config.r2.secretAccessKey.trim(),
    },
  });

  return s3ClientInstance;
}

/**
 * Helper to check if a string is a base64 encoded image
 */
export function isBase64Image(str: string): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  if (trimmed.startsWith("data:image/")) return true;
  // If long base64 string without data prefix
  if (trimmed.length > 200 && /^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 100))) {
    return true;
  }
  return false;
}

export interface ParsedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

/**
 * Parses a base64 string or data URL into a binary buffer, MIME type, and file extension
 */
export function parseImagePayload(payload: string | Buffer): ParsedImage {
  if (Buffer.isBuffer(payload)) {
    return {
      buffer: payload,
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  }

  const str = payload.trim();
  const match = str.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);

  if (match) {
    const rawType = match[1].toLowerCase();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");
    
    let extension = rawType;
    if (extension === "jpeg") extension = "jpg";
    if (extension === "svg+xml") extension = "svg";

    return {
      buffer,
      mimeType: `image/${rawType}`,
      extension,
    };
  }

  // Check if raw base64 string
  const buffer = Buffer.from(str, "base64");
  return {
    buffer,
    mimeType: "image/jpeg",
    extension: "jpg",
  };
}

export interface UploadPhotographOptions {
  data: string | Buffer;
  userEmail?: string;
  customFileName?: string;
  folderName?: string;
  bucketName?: string;
}

export interface UploadPhotographResult {
  success: boolean;
  url: string;
  key: string;
  bucket: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  offlineFallback?: boolean;
}

/**
 * Uploads a photograph to Cloudflare R2 bucket (default: astrologybuckets) 
 * inside the designated folder (default: astro-users)
 */
export async function uploadPhotographToR2(
  options: UploadPhotographOptions
): Promise<UploadPhotographResult> {
  const {
    data,
    userEmail,
    customFileName,
    folderName = config.r2.folderName || "astro-users",
    bucketName = config.r2.bucketName || "astrologybuckets",
  } = options;

  const { buffer, mimeType, extension } = parseImagePayload(data);

  // If R2 is not configured in .env yet, gracefully log a clear notice
  // and preserve availability without crashing the request
  if (!isR2Configured()) {
    console.warn(
      `[Cloudflare R2] Warning: R2 credentials are not configured in .env. ` +
      `Bucket: "${bucketName}", Folder: "${folderName}". ` +
      `Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.`
    );

    // Return fallback result (e.g. data URL if data was string)
    const fallbackUrl = typeof data === "string" && data.startsWith("data:") 
      ? data 
      : `data:${mimeType};base64,${buffer.toString("base64")}`;

    return {
      success: false,
      offlineFallback: true,
      url: fallbackUrl,
      key: `${folderName}/unconfigured_${Date.now()}.${extension}`,
      bucket: bucketName,
      folder: folderName,
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  // Construct safe unique file name inside the requested folder
  let fileName = customFileName;
  if (!fileName) {
    const safePrefix = userEmail
      ? userEmail.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24)
      : "photo";
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 8);
    fileName = `${safePrefix}_${timestamp}_${randomHex}.${extension}`;
  }

  // Normalize object key inside folder
  const cleanFolder = folderName.replace(/^\/+|\/+$/g, "");
  const objectKey = `${cleanFolder}/${fileName}`;

  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      userEmail: userEmail || "anonymous",
      uploadedAt: new Date().toISOString(),
    },
  });

  await client.send(command);

  // Construct the accessible URL for the uploaded photograph
  let publicUrl = "";
  if (config.r2.publicUrl) {
    const cleanPublicBase = config.r2.publicUrl.replace(/\/+$/, "");
    publicUrl = `${cleanPublicBase}/${objectKey}`;
  } else {
    // If no custom domain/r2.dev domain is provided, point to our server's streaming route
    // which proxies R2 objects seamlessly
    publicUrl = `/api/photos/${objectKey}`;
  }

  return {
    success: true,
    url: publicUrl,
    key: objectKey,
    bucket: bucketName,
    folder: cleanFolder,
    mimeType,
    sizeBytes: buffer.length,
  };
}

/**
 * Retrieve a photo stream from Cloudflare R2 by its key
 */
export async function getPhotoFromR2(key: string, bucketName?: string) {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const client = getR2Client();
  const targetBucket = bucketName || config.r2.bucketName || "astrologybuckets";

  const command = new GetObjectCommand({
    Bucket: targetBucket,
    Key: key,
  });

  return await client.send(command);
}

/**
 * Diagnostics and configuration status for Cloudflare R2
 */
export function getR2Diagnostics() {
  return {
    configured: isR2Configured(),
    bucketName: config.r2.bucketName || "astrologybuckets",
    folderName: config.r2.folderName || "astro-users",
    hasAccountId: Boolean(config.r2.accountId),
    hasAccessKeyId: Boolean(config.r2.accessKeyId),
    hasSecretAccessKey: Boolean(config.r2.secretAccessKey),
    publicUrlConfigured: Boolean(config.r2.publicUrl),
    endpoint: config.r2.accountId
      ? `https://${config.r2.accountId}.r2.cloudflarestorage.com`
      : "Not configured",
  };
}
