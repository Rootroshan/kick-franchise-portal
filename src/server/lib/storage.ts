import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSetting } from "@/server/modules/settings/platformSettings";

let client: S3Client | null = null;
let clientKey: string | null = null;

/**
 * R2 client built from the active credentials.
 *
 * Async because credentials may come from the database (entered via admin
 * settings) rather than only the environment. Cached against the credentials it
 * was built with, so a key changed in the UI applies on the next call instead
 * of requiring a redeploy.
 */
async function r2Client(): Promise<S3Client> {
  const [accountId, accessKeyId, secretAccessKey, endpointOverride] = await Promise.all([
    getSetting("R2_ACCOUNT_ID"),
    getSetting("R2_ACCESS_KEY_ID"),
    getSetting("R2_SECRET_ACCESS_KEY"),
    getSetting("R2_ENDPOINT"),
  ]);

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured. Add credentials in Settings.");
  }

  const cacheKey = `${accountId}:${accessKeyId}:${secretAccessKey}:${endpointOverride}`;
  if (client && clientKey === cacheKey) return client;

  client = new S3Client({
    region: "auto",
    endpoint: endpointOverride || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  clientKey = cacheKey;
  return client;
}

/** Bucket name from settings, falling back to the env default. */
async function r2Bucket(): Promise<string> {
  return (await getSetting("R2_BUCKET")) || "kick-assets";
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
  const [s3, Bucket] = await Promise.all([r2Client(), r2Bucket()]);
  const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: mime });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

/**
 * Uploads a file to R2 directly from our server (server-to-server, not
 * subject to browser CORS — unlike a presigned URL, which requires the R2
 * bucket to have a CORS policy allowing the browser's origin to PUT
 * directly). Used by upload flows that accept the file as a server-side
 * multipart body instead of doing a client-side presigned PUT.
 */
export async function uploadObjectDirect(key: string, mime: string, body: Buffer): Promise<void> {
  const [s3, Bucket] = await Promise.all([r2Client(), r2Bucket()]);
  await s3.send(new PutObjectCommand({ Bucket, Key: key, ContentType: mime, Body: body }));
}

/**
 * Presigned GET for franchisee/admin downloads. Expires within 5 minutes per
 * spec §14 — never expose a permanent public bucket URL.
 */
export async function createPresignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
  const [s3, Bucket] = await Promise.all([r2Client(), r2Bucket()]);
  const cmd = new GetObjectCommand({ Bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: Math.min(ttlSeconds, 300) });
}

export async function deleteStorageObject(key: string): Promise<void> {
  const [s3, Bucket] = await Promise.all([r2Client(), r2Bucket()]);
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

export async function storageObjectExists(key: string): Promise<boolean> {
  const [s3, Bucket] = await Promise.all([r2Client(), r2Bucket()]);
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
