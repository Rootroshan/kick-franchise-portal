import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import Stripe from "stripe";
import { getSetting } from "@/server/modules/settings/platformSettings";

export type TestResult = {
  ok: boolean;
  /** Safe, human-readable outcome. NEVER contains a key or raw provider error. */
  message: string;
  /** Extra non-sensitive context, e.g. which mode a Stripe key is in. */
  detail?: string;
};

/**
 * Connection tests for externally-configured integrations.
 *
 * These deliberately do NOT surface the provider's raw error string. SDK errors
 * frequently echo request context (including the credential that was sent), so
 * returning err.message could reflect a secret back into the UI, the browser's
 * network log, and any log drain. Instead each known failure mode is mapped to
 * a fixed message that tells the admin what to fix without quoting the input.
 */

export async function testStripe(): Promise<TestResult> {
  const key = await getSetting("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, message: "No key set. Add a Stripe secret key above and save." };

  try {
    const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
    // balance.retrieve is the cheapest authenticated call: no side effects,
    // and it fails distinctly on a bad vs. under-permissioned key.
    await stripe.balance.retrieve();
    const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";
    return {
      ok: true,
      message: "Connected to Stripe.",
      detail:
        mode === "live"
          ? "Using a LIVE key — real charges will be processed."
          : mode === "test"
            ? "Using a TEST key — no real charges will be processed."
            : undefined,
    };
  } catch (err) {
    return { ok: false, message: describeStripeError(err) };
  }
}

function describeStripeError(err: unknown): string {
  const type = (err as { type?: string } | null)?.type;
  switch (type) {
    case "StripeAuthenticationError":
      return "Stripe rejected the key. Check it was copied in full and has not been revoked.";
    case "StripePermissionError":
      return "Key is valid but lacks permission. Use a secret key, not a restricted key.";
    case "StripeConnectionError":
      return "Could not reach Stripe. Check network access and retry.";
    case "StripeRateLimitError":
      return "Rate limited by Stripe. Wait a moment and retry.";
    default:
      return "Stripe connection failed. Verify the key is a valid secret key.";
  }
}

export async function testR2(): Promise<TestResult> {
  const [accountId, accessKeyId, secretAccessKey, endpointOverride, bucketSetting] = await Promise.all([
    getSetting("R2_ACCOUNT_ID"),
    getSetting("R2_ACCESS_KEY_ID"),
    getSetting("R2_SECRET_ACCESS_KEY"),
    getSetting("R2_ENDPOINT"),
    getSetting("R2_BUCKET"),
  ]);
  const bucket = bucketSetting || "kick-assets";

  const missing = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
  ].filter(Boolean) as string[];

  if (missing.length) {
    return { ok: false, message: `Not configured. Missing: ${missing.join(", ")}.` };
  }

  const endpoint = endpointOverride || `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    // HeadBucket verifies credentials AND that this token can see the bucket —
    // a token scoped to a different bucket fails here rather than at upload time.
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, message: "Connected to R2.", detail: `Bucket "${bucket}" is reachable.` };
  } catch (err) {
    return { ok: false, message: describeR2Error(err, bucket) };
  }
}

function describeR2Error(err: unknown, bucket: string): string {
  const name = (err as { name?: string } | null)?.name;
  const status = (err as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;

  if (name === "NotFound" || status === 404) {
    return `Credentials work, but bucket "${bucket}" was not found. Check R2_BUCKET and that the bucket exists.`;
  }
  if (name === "Forbidden" || status === 403) {
    return `Access denied to bucket "${bucket}". Check the API token has Object Read & Write for this bucket.`;
  }
  if (status === 401) {
    return "R2 rejected the credentials. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.";
  }
  return "R2 connection failed. Verify the account ID, token, and bucket name.";
}
