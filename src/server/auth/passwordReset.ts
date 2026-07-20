import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { authPrisma } from "@/server/db/authClient";
import { hashPassword, validatePasswordStrength } from "./password";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Password reset via a single-use emailed token.
 *
 * Only the SHA-256 of the token is stored: a leaked VerificationToken table
 * then yields nothing usable, since the raw token cannot be derived from its
 * hash. The raw value exists only in the email.
 */

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a reset token. Returns null when the address has no active account —
 * callers MUST still report success to the user, or this becomes a way to test
 * which addresses are registered.
 */
export async function createResetToken(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  const user = await authPrisma.user.findUnique({ where: { email: normalised } });
  if (!user || !user.isActive) return null;

  const raw = randomBytes(32).toString("hex");

  // Invalidate any outstanding tokens: a reset request should supersede its
  // predecessors rather than leaving several valid at once.
  await authPrisma.verificationToken.deleteMany({ where: { identifier: normalised } });
  await authPrisma.verificationToken.create({
    data: { identifier: normalised, token: hashToken(raw), expires: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  return raw;
}

export type ResetOutcome = { ok: true } | { ok: false; message: string };

/** Consumes a reset token and sets the new password. Single use. */
export async function resetPasswordWithToken(rawToken: string, newPassword: string): Promise<ResetOutcome> {
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { ok: false, message: strengthError };

  const record = await authPrisma.verificationToken.findUnique({ where: { token: hashToken(rawToken) } });
  if (!record) return { ok: false, message: "That reset link is invalid or has already been used." };

  if (record.expires < new Date()) {
    await authPrisma.verificationToken.deleteMany({ where: { token: record.token } });
    return { ok: false, message: "That reset link has expired. Request a new one." };
  }

  const user = await authPrisma.user.findUnique({ where: { email: record.identifier } });
  if (!user || !user.isActive) {
    return { ok: false, message: "That reset link is invalid or has already been used." };
  }

  await authPrisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Single use — delete before returning so a replayed link fails.
  await authPrisma.verificationToken.deleteMany({ where: { identifier: record.identifier } });

  return { ok: true };
}

/** Constant-time compare, for callers that need to match tokens directly. */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
