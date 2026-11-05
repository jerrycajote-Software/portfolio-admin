import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

const clean = (val?: string) => val?.trim().replace(/^["']|["']$/g, "") || "";

const r2AccountId = clean(process.env.R2_ACCOUNT_ID);
const r2AccessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
const r2SecretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
const r2BucketName = clean(process.env.R2_BUCKET_NAME) || "portfolio-media";
const r2PublicUrl = clean(process.env.R2_PUBLIC_URL);

const cloudinaryCloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
const cloudinaryApiKey = clean(process.env.CLOUDINARY_API_KEY);
const cloudinaryApiSecret = clean(process.env.CLOUDINARY_API_SECRET);

export function isR2Configured(): boolean {
  return Boolean(
    r2AccountId &&
    r2AccessKeyId &&
    r2SecretAccessKey
  );
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    cloudinaryCloudName &&
    cloudinaryApiKey &&
    cloudinaryApiSecret
  );
}

export function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production"
  );
}

export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "certificates"
): Promise<{ url: string; key: string; provider: "r2" | "cloudinary" | "local" }> {
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueKey = `${folder}/${Date.now()}-${sanitizedName}`;

  // 1. Cloudflare R2 (Primary cloud storage)
  if (isR2Configured()) {
    try {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
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
    } catch (err: any) {
      console.error("Cloudflare R2 upload error:", err);
      // In production/serverless, do not attempt local write that will crash with read-only filesystem (EROFS)
      if (isServerlessEnvironment()) {
        throw new Error(`Cloudflare R2 upload failed: ${err.message || err}`);
      }
    }
  }

  // 2. Cloudinary (Secondary cloud storage fallback)
  if (isCloudinaryConfigured()) {
    try {
      cloudinary.config({
        cloud_name: cloudinaryCloudName,
        api_key: cloudinaryApiKey,
        api_secret: cloudinaryApiSecret,
        secure: true,
      });

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `portfolio/${folder}`,
            public_id: `${Date.now()}-${sanitizedName.replace(/\.[^/.]+$/, "")}`,
            resource_type: "auto",
          },
          (err, result) => {
            if (err || !result) reject(err || new Error("Cloudinary upload failed"));
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      return {
        url: uploadResult.secure_url,
        key: uploadResult.public_id,
        provider: "cloudinary",
      };
    } catch (err: any) {
      console.error("Cloudinary upload error:", err);
      if (isServerlessEnvironment()) {
        throw new Error(`Cloudinary upload failed: ${err.message || err}`);
      }
    }
  }

  // 3. In Serverless / Production: Stop if no cloud storage is configured
  if (isServerlessEnvironment()) {
    throw new Error(
      "Cloud storage is not configured for production. " +
      "Because serverless hosting (Vercel) has a read-only filesystem, you must configure Cloudflare R2 " +
      "(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) " +
      "or Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) " +
      "in your Vercel Project Settings > Environment Variables."
    );
  }

  // 4. Local Disk Fallback (Development only)
  try {
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
  } catch (fsErr: any) {
    throw new Error(
      `Cannot save file to local disk (${fsErr.message}). In production, configure Cloudflare R2 or Cloudinary.`
    );
  }
}
