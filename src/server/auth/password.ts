import argon2 from "argon2";

/**
 * Password hashing — argon2id.
 *
 * argon2id (not bcrypt) because it is memory-hard: an attacker with GPUs gains
 * far less advantage per guess. These parameters follow the OWASP Password
 * Storage Cheat Sheet minimum (19 MiB, t=2, p=1).
 *
 * The salt is generated per-hash by argon2 and embedded in the output string,
 * so no separate salt column is needed.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

/**
 * Verifies a password. Returns false rather than throwing on a malformed hash:
 * a corrupt row must read as "wrong password", never as a 500 that reveals the
 * account exists.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Minimum policy for a new password. Returns null when acceptable. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password must be under 200 characters.";
  return null;
}
