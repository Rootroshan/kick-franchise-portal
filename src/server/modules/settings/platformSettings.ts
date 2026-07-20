import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { encryptSecret, decryptSecret, lastFourOf, isEncryptionConfigured } from "@/server/lib/secretBox";
import { getEnv } from "@/lib/env";
import type { RequestContext } from "@/server/db/withTenant";

/** Keys settable through the admin UI. Anything not listed here is rejected. */
export const SETTABLE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
] as const;

export type SettableKey = (typeof SETTABLE_KEYS)[number];

/** Values that are not credentials — safe to display in full in the UI. */
const NON_SECRET: ReadonlySet<string> = new Set([
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]);

export function isSettableKey(k: string): k is SettableKey {
  return (SETTABLE_KEYS as readonly string[]).includes(k);
}

export type SettingStatus = {
  key: SettableKey;
  /** Whether a value exists (from DB or env). Never implies the value itself. */
  configured: boolean;
  /** "database" | "environment" | null — where the active value comes from. */
  source: "database" | "environment" | null;
  /** Masked hint for secrets ("••••4242"), full value for non-secrets. */
  display: string | null;
  updatedAt: Date | null;
};

/**
 * Resolves a platform setting: database value takes precedence over the env var,
 * so a key entered in the UI overrides a stale deploy-time value.
 *
 * Returns "" (not undefined) when unset, matching env.ts's defaults so callers
 * can keep using falsy checks.
 */
export async function getSetting(key: SettableKey): Promise<string> {
  if (isEncryptionConfigured()) {
    try {
      const row = await withTenant(kickSystemCtx(), (tx) => tx.platformSetting.findUnique({ where: { key } }));
      if (row) return decryptSecret(row.valueEnc);
    } catch {
      // Fall through to env: a decrypt failure (rotated key, corrupt row) must
      // not take down checkout — the deploy-time env value is still valid.
    }
  }
  const envValue = (getEnv() as Record<string, unknown>)[key];
  return typeof envValue === "string" ? envValue : "";
}

/** Status of every settable key, for rendering the settings UI. Never returns secrets. */
export async function listSettingStatus(ctx: RequestContext): Promise<SettingStatus[]> {
  const rows = isEncryptionConfigured()
    ? await withTenant(ctx, (tx) => tx.platformSetting.findMany())
    : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const env = getEnv() as Record<string, unknown>;

  return SETTABLE_KEYS.map((key) => {
    const row = byKey.get(key);
    if (row) {
      return {
        key,
        configured: true,
        source: "database" as const,
        display: NON_SECRET.has(key) ? safeDecrypt(row.valueEnc) : `••••${row.lastFour ?? ""}`,
        updatedAt: row.updatedAt,
      };
    }
    const envValue = typeof env[key] === "string" ? (env[key] as string) : "";
    return {
      key,
      configured: Boolean(envValue),
      source: envValue ? ("environment" as const) : null,
      display: envValue ? (NON_SECRET.has(key) ? envValue : `••••${lastFourOf(envValue)}`) : null,
      updatedAt: null,
    };
  });
}

function safeDecrypt(enc: string): string {
  try {
    return decryptSecret(enc);
  } catch {
    return "(unreadable — encryption key may have changed)";
  }
}

/**
 * Stores a credential, encrypted, and audit-logs the change.
 *
 * The audit record deliberately stores only the last four characters: an audit
 * log is widely readable by KICK_ADMINs and is exactly the wrong place to
 * duplicate a secret we just took care to encrypt.
 */
export async function setSetting(ctx: RequestContext, key: SettableKey, rawValue: string): Promise<void> {
  const value = rawValue.trim();
  if (!value) throw new Error("Value cannot be empty.");
  if (!isEncryptionConfigured()) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is not set on the server. Add it, then redeploy.");
  }

  const existing = await withTenant(ctx, (tx) => tx.platformSetting.findUnique({ where: { key } }));

  await withTenant(ctx, async (tx) => {
    await tx.platformSetting.upsert({
      where: { key },
      create: { key, valueEnc: encryptSecret(value), lastFour: lastFourOf(value), updatedBy: ctx.userId },
      update: { valueEnc: encryptSecret(value), lastFour: lastFourOf(value), updatedBy: ctx.userId },
    });

    await writeAuditLog(tx, {
      tenantId: null, // platform-level, not tenant-scoped
      actorId: ctx.userId,
      role: ctx.role,
      action: existing ? "platformSetting.update" : "platformSetting.create",
      entity: "PlatformSetting",
      entityId: key,
      before: existing ? { key, lastFour: existing.lastFour } : undefined,
      after: { key, lastFour: lastFourOf(value) },
    });
  });
}

/** Removes a stored credential, falling back to the env value if one exists. */
export async function clearSetting(ctx: RequestContext, key: SettableKey): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.platformSetting.findUnique({ where: { key } });
    if (!existing) return;

    await tx.platformSetting.delete({ where: { key } });
    await writeAuditLog(tx, {
      tenantId: null,
      actorId: ctx.userId,
      role: ctx.role,
      action: "platformSetting.delete",
      entity: "PlatformSetting",
      entityId: key,
      before: { key, lastFour: existing.lastFour },
    });
  });
}

/**
 * System context for reads that happen outside a request (e.g. the Stripe client
 * resolving its key). PlatformSetting is platform-wide, so there is no tenant to
 * scope to; RLS still requires a KICK_ADMIN role GUC to read the table.
 */
function kickSystemCtx(): RequestContext {
  return { userId: "system", role: "KICK_ADMIN", tenantId: null, locationId: null } as RequestContext;
}
