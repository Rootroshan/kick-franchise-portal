import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Authenticated encryption for secrets stored in the database.
 *
 * AES-256-GCM (not CBC): GCM authenticates the ciphertext, so tampering is
 * detected on decrypt rather than silently yielding garbage plaintext. Each
 * encrypt uses a fresh random IV, so encrypting the same key twice produces
 * different ciphertext and equality cannot be inferred from the stored value.
 *
 * The key comes from SETTINGS_ENCRYPTION_KEY and is intentionally NOT stored in
 * the database it protects: a stolen dump then contains only ciphertext. If the
 * two ever live together the encryption is decorative.
 */

const FORMAT = "v1"; // prefix so the scheme can be rotated later without ambiguity

function encryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is missing or too short (need >= 32 chars). " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  // SHA-256 normalises any sufficiently long passphrase to the exact 32 bytes
  // AES-256 requires, without imposing a specific input encoding on the operator.
  return createHash("sha256").update(raw).digest();
}

/** True when a key is configured — lets callers fail helpfully instead of throwing. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  return Boolean(raw && raw.length >= 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV is the GCM-recommended size
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [format, ivB64, tagB64, ctB64] = stored.split(":");
  if (format !== FORMAT || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Stored secret is not in the expected format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  // Throws if the ciphertext or tag was altered, or the key is wrong.
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Display hint for the UI: last 4 chars only, never enough to reconstruct the key. */
export function lastFourOf(secret: string): string {
  return secret.length <= 4 ? "••••" : secret.slice(-4);
}
