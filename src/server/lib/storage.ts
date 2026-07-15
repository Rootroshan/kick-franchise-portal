import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB cap for brand assets
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/zip", "video/"];

export function assertValidUpload(mime: string, sizeBytes: number) {
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`);
  }
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error(`File type "${mime}" is not permitted`);
  }
}

/** Presigned PUT for admin uploads. Expires in 5 minutes. */
export async function createPresignedUploadUrl(key: string, mime: string): Promise<string> {
  const env = getEnv();
  const cmd = new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: mime });
  return getSignedUrl(r2Client(), cmd, { expiresIn: 300 });
}

/**
 * Presigned GET for franchisee/admin downloads. Expires within 5 minutes per
 * spec §14 — never expose a permanent public bucket URL.
 */
export async function createPresignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
  const env = getEnv();
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return getSignedUrl(r2Client(), cmd, { expiresIn: Math.min(ttlSeconds, 300) });
}

export async function deleteStorageObject(key: string): Promise<void> {
  const env = getEnv();
  await r2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}
