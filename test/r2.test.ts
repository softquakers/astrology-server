import { createApp } from "../src/app.js";
import { parseImagePayload, isBase64Image, getR2Diagnostics } from "../src/services/r2Service.js";

async function runR2Tests() {
  console.log("=== Testing Cloudflare R2 Service & Endpoints ===");

  // 1. Test image parsing and base64 detection
  const sampleDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  
  if (!isBase64Image(sampleDataUrl)) {
    throw new Error("Failed to recognize valid base64 data URL");
  }

  const parsed = parseImagePayload(sampleDataUrl);
  if (parsed.mimeType !== "image/jpeg" || parsed.extension !== "jpg" || !Buffer.isBuffer(parsed.buffer)) {
    throw new Error(`Parsed image mismatch: mime=${parsed.mimeType}, ext=${parsed.extension}`);
  }
  console.log("✓ parseImagePayload correctly parsed MIME type and binary buffer");

  // 2. Test R2 diagnostics configuration
  const diagnostics = getR2Diagnostics();
  if (diagnostics.bucketName !== "astrologybuckets") {
    throw new Error(`Expected bucketName 'astrologybuckets', got '${diagnostics.bucketName}'`);
  }
  if (diagnostics.folderName !== "astro-users") {
    throw new Error(`Expected folderName 'astro-users', got '${diagnostics.folderName}'`);
  }
  console.log("✓ Cloudflare R2 configured with bucket 'astrologybuckets' and folder 'astro-users'");

  // 3. Test HTTP endpoints
  const app = createApp();
  const testPort = 5198;
  const server = app.listen(testPort, async () => {
    try {
      // Test GET /api/photos/status
      const statusRes = await fetch(`http://localhost:${testPort}/api/photos/status`);
      if (statusRes.status !== 200) {
        throw new Error(`GET /api/photos/status failed with ${statusRes.status}`);
      }
      const statusJson = (await statusRes.json()) as any;
      if (statusJson.bucketName !== "astrologybuckets" || statusJson.folderName !== "astro-users") {
        throw new Error("Diagnostics endpoint returned incorrect bucket or folder");
      }
      console.log("✓ GET /api/photos/status returned bucket:", statusJson.bucketName, "folder:", statusJson.folderName);

      // Test POST /api/users/upload-photo
      const uploadRes = await fetch(`http://localhost:${testPort}/api/users/upload-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: sampleDataUrl,
          email: "astrotest@example.com",
        }),
      });
      if (uploadRes.status !== 200) {
        throw new Error(`POST /api/users/upload-photo failed with ${uploadRes.status}`);
      }
      const uploadJson = (await uploadRes.json()) as any;
      if (!uploadJson.key || !uploadJson.key.startsWith("astro-users/")) {
        throw new Error(`Upload response key does not start with astro-users/: ${uploadJson.key}`);
      }
      if (uploadJson.bucket !== "astrologybuckets") {
        throw new Error(`Upload response bucket mismatch: ${uploadJson.bucket}`);
      }
      console.log("✓ POST /api/users/upload-photo verified. Target Key:", uploadJson.key);

      // Test POST /api/users/signup with photoUrl
      const signupRes = await fetch(`http://localhost:${testPort}/api/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `test_r2_${Date.now()}@example.com`,
          name: "R2 Stargazer",
          photoUrl: sampleDataUrl,
          dob: "1990-05-15",
          birthTime: "10:30",
          birthPlace: "Athens, Greece",
        }),
      });
      if (signupRes.status !== 200) {
        throw new Error(`POST /api/users/signup failed with ${signupRes.status}`);
      }
      const signupJson = (await signupRes.json()) as any;
      if (!signupJson.user?.photoUrl) {
        throw new Error("Sign up response did not return photoUrl");
      }
      console.log("✓ POST /api/users/signup verified with photoUrl handled gracefully");

      console.log(" All Cloudflare R2 unit and endpoint tests passed!");
      process.exit(0);
    } catch (err) {
      console.error("Test failure:", err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

runR2Tests();
