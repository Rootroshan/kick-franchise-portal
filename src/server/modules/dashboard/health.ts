import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { getSetting } from "@/server/modules/settings/platformSettings";

export type ServiceHealth = { name: string; status: "ok" | "degraded" | "down" | "not_configured" };

export type StorageUsage = {
  totalBytes: number;
  assetCount: number;
  byTenant: Array<{ tenantId: string; tenantName: string; bytes: number; assetCount: number }>;
};

/**
 * Storage usage derived from Asset.sizeBytes rather than R2's API: R2 exposes
 * no cheap "bucket size" call, so the alternative is paginating every object on
 * each page load. This counts ACTIVE assets only — archived rows keep their
 * bytes in the table but no longer represent live storage the admin can act on.
 *
 * Caveat: an object orphaned in R2 by a failed upload has no Asset row and so
 * is not counted. Under-reporting a stray file is preferable to a slow page.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const rows = await prisma.asset.groupBy({
    by: ["tenantId"],
    where: { status: "ACTIVE" },
    _sum: { sizeBytes: true },
    _count: { _all: true },
  });

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));

  const byTenant = rows
    .map((r) => ({
      tenantId: r.tenantId,
      tenantName: nameById.get(r.tenantId) ?? "Unknown brand",
      bytes: r._sum.sizeBytes ?? 0,
      assetCount: r._count._all,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    totalBytes: byTenant.reduce((sum, t) => sum + t.bytes, 0),
    assetCount: byTenant.reduce((sum, t) => sum + t.assetCount, 0),
    byTenant,
  };
}

/**
 * Safe platform health snapshot. Never exposes secret values — only reports
 * whether each service is reachable/configured. DB is actively pinged;
 * others are reported as "configured" (a key is present) vs "not_configured"
 * to avoid slow/blocking network calls on every dashboard load.
 */
export async function getSystemHealth(): Promise<{ services: ServiceHealth[]; version: string; environment: string }> {
  const env = getEnv();

  let dbStatus: ServiceHealth["status"] = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "down";
  }

  // RLS check: confirm the app role cannot bypass RLS (cheap catalog read).
  let rlsStatus: ServiceHealth["status"] = "degraded";
  try {
    const rows = await prisma.$queryRaw<Array<{ rolbypassrls: boolean; rolsuper: boolean }>>`
      SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user
    `;
    const r = rows[0];
    rlsStatus = r && !r.rolbypassrls && !r.rolsuper ? "ok" : "degraded";
  } catch {
    rlsStatus = "degraded";
  }

  const configured = (v: string): ServiceHealth["status"] => (v ? "ok" : "not_configured");

  // Stripe/R2 may be configured via admin settings (DB) rather than env, so
  // resolve through getSetting() instead of reading env directly.
  const [stripeKey, r2Key] = await Promise.all([
    getSetting("STRIPE_SECRET_KEY").catch(() => ""),
    getSetting("R2_ACCESS_KEY_ID").catch(() => ""),
  ]);

  return {
    services: [
      { name: "Database", status: dbStatus },
      { name: "RLS Security", status: rlsStatus },
      { name: "Redis / Worker", status: configured(env.REDIS_URL) },
      { name: "R2 Storage", status: configured(r2Key) },
      { name: "Stripe", status: configured(stripeKey) },
      { name: "Push (VAPID)", status: configured(env.VAPID_PUBLIC_KEY) },
      { name: "Email (Resend)", status: configured(env.RESEND_API_KEY) },
    ],
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
  };
}
