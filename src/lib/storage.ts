import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const r2BucketName = process.env.R2_BUCKET_NAME?.trim() || "portfolio-media";
const r2PublicUrl = process.env.R2_PUBLIC_URL?.trim();

export function isR2Configured(): boolean {
  return Boolean(
    r2AccountId &&
      r2AccessKeyId &&
      r2SecretAccessKey &&
      r2AccountId !== '""' &&
      r2AccessKeyId !== '""'
  );
}

export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "certificates"
): Promise<{ url: string; key: string; provider: "r2" | "local" }> {
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueKey = `${folder}/${Date.now()}-${sanitizedName}`;

  if (isR2Configured()) {
    try {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKeyId!,
          secretAccessKey: r2SecretAccessKey!,
        },
      });

      await s3.send(
        new PutObjectCommand({
          Bucket: r2BucketName,
          Key: uniqueKey,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const publicBase = r2PublicUrl
        ? r2PublicUrl.replace(/\/+$/, "")
        : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}`;

      return {
        url: `${publicBase}/${uniqueKey}`,
        key: uniqueKey,
        provider: "r2",
      };
    } catch (err) {
      console.error("Cloudflare R2 upload error, falling back to local:", err);
    }
  }

  // Local fallback: save to public/uploads
  const targetDirAdmin = path.join(process.cwd(), "public", "uploads", folder);
  const targetDirFrontend = path.join(
    process.cwd(),
    "..",
    "portfolio-frontend",
    "public",
    "uploads",
    folder
  );

  fs.mkdirSync(targetDirAdmin, { recursive: true });
  try {
    fs.mkdirSync(targetDirFrontend, { recursive: true });
  } catch {
    // Ignore if frontend directory doesn't exist at relative path
  }

  const localFileName = `${Date.now()}-${sanitizedName}`;
  const localPathAdmin = path.join(targetDirAdmin, localFileName);
  fs.writeFileSync(localPathAdmin, buffer);

  try {
    const localPathFrontend = path.join(targetDirFrontend, localFileName);
    fs.writeFileSync(localPathFrontend, buffer);
  } catch {
    // Ignore if frontend dir not found
  }

  return {
    url: `/uploads/${folder}/${localFileName}`,
    key: uniqueKey,
    provider: "local",
  };
}

