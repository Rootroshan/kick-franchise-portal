import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";

export type ServiceHealth = { name: string; status: "ok" | "degraded" | "down" | "not_configured" };

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

  return {
    services: [
      { name: "Database", status: dbStatus },
      { name: "RLS Security", status: rlsStatus },
      { name: "Redis / Worker", status: configured(env.REDIS_URL) },
      { name: "R2 Storage", status: configured(env.R2_ACCESS_KEY_ID) },
      { name: "Stripe", status: configured(env.STRIPE_SECRET_KEY) },
      { name: "Push (VAPID)", status: configured(env.VAPID_PUBLIC_KEY) },
      { name: "Email (Resend)", status: configured(env.RESEND_API_KEY) },
    ],
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
  };
}
