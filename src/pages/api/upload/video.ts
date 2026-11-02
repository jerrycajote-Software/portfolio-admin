import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

// 1GB limit in bytes
export const MAX_VIDEO_SIZE_BYTES = 1024 * 1024 * 1024; // 1,073,741,824 bytes (1GB)

export const config = {
  api: {
    bodyParser: false, // Stream direct to disk to handle 1GB videos without memory exhaustion
  },
};

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/ogg",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Admin authentication check
  const session = await auth(req, res);
  if (!session || session.user?.role !== "ADMIN") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rawContentType = req.headers["content-type"] || "video/mp4";
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  const rawFilename = (req.headers["x-filename"] as string) || "demo-video.mp4";
  let decodedFilename = "demo-video.mp4";
  try {
    decodedFilename = decodeURIComponent(rawFilename);
  } catch {
    decodedFilename = rawFilename;
  }

  const sanitizedFilename = decodedFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = path.extname(sanitizedFilename) || ".mp4";
  const uniqueName = `${Date.now()}-${sanitizedFilename}`;

  // Check declared content-length
  const contentLengthHeader = req.headers["content-length"];
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > MAX_VIDEO_SIZE_BYTES) {
      return res.status(413).json({
        error: `Video exceeds the 1GB limit (size: ${(contentLength / (1024 * 1024)).toFixed(1)} MB).`,
      });
    }
  }

  // Setup upload directories
  const targetDirAdmin = path.join(process.cwd(), "public", "uploads", "videos");
  const targetDirFrontend = path.join(
    process.cwd(),
    "..",
    "portfolio-frontend",
    "public",
    "uploads",
    "videos"
  );

  fs.mkdirSync(targetDirAdmin, { recursive: true });
  try {
    fs.mkdirSync(targetDirFrontend, { recursive: true });
  } catch {
    // Ignore if relative path not reachable
  }

  const filePathAdmin = path.join(targetDirAdmin, uniqueName);
  const fileStream = fs.createWriteStream(filePathAdmin);

  let totalBytes = 0;
  let hasAborted = false;

  req.on("data", (chunk: Buffer) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_VIDEO_SIZE_BYTES) {
      hasAborted = true;
      fileStream.destroy();
      try {
        if (fs.existsSync(filePathAdmin)) fs.unlinkSync(filePathAdmin);
      } catch {}
      return res.status(413).json({
        error: "Video file exceeds maximum allowable size of 1GB.",
      });
    }
    fileStream.write(chunk);
  });

  req.on("end", () => {
    if (hasAborted) return;
    fileStream.end(async () => {
      // Mirror to frontend uploads folder for local multi-repo serving
      try {
        const filePathFrontend = path.join(targetDirFrontend, uniqueName);
        fs.copyFileSync(filePathAdmin, filePathFrontend);
      } catch (copyErr) {
        // Continue if frontend folder sync is unavailable
      }

      const sizeDisplay =
        totalBytes >= 1024 * 1024 * 1024
          ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
          : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

      return res.status(200).json({
        url: `/uploads/videos/${uniqueName}`,
        filename: sanitizedFilename,
        size: totalBytes,
        sizeDisplay,
        contentType,
      });
    });
  });

  req.on("error", (err) => {
    fileStream.destroy();
    try {
      if (fs.existsSync(filePathAdmin)) fs.unlinkSync(filePathAdmin);
    } catch {}
    console.error("Video stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to upload video stream" });
    }
  });
}
