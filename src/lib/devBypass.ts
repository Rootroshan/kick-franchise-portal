import type { RequestContext } from "@/server/db/withTenant";

/**
 * ============================================================================
 * DEV-ONLY AUTH BYPASS — quarantined here on purpose.
 * ============================================================================
 * This is the ONLY file containing auth-bypass logic. It lets the app run on
 * localhost before a real Clerk account exists. Production code (middleware,
 * layout, requestContext) only ever CALLS into this file — the bypass itself
 * lives nowhere else, so a security review has exactly one file to audit.
 *
 * Two independent conditions must BOTH hold for any of this to activate:
 *   1. NODE_ENV === "development"   (false in every deployed build)
 *   2. DEV_BYPASS_AUTH === "true"   (set only in a local .env.local, which is
 *                                    gitignored and omitted from .env.example)
 * If either is false, isDevBypassEnabled() returns false and every consumer
 * falls through to the real Clerk path. There is no code path by which this
 * can activate in a deployed environment.
 * ============================================================================
 */
export function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";
}

/**
 * Builds a fake trusted context from DEV_BYPASS_ROLE / DEV_BYPASS_TENANT_ID /
 * DEV_BYPASS_LOCATION_ID, short-circuiting the entire Clerk/host/Membership
 * resolution. Returns null when the bypass is disabled, so getRequestContext()
 * proceeds down the real path unchanged.
 */
export function devBypassContext(): RequestContext | null {
  if (!isDevBypassEnabled()) {
    return null;
  }
  const role = (process.env.DEV_BYPASS_ROLE as RequestContext["role"]) || "KICK_ADMIN";
  return {
    tenantId: role === "KICK_ADMIN" ? null : process.env.DEV_BYPASS_TENANT_ID || null,
    role,
    locationId: process.env.DEV_BYPASS_LOCATION_ID || null,
    userId: "dev-bypass-user",
  };
}
