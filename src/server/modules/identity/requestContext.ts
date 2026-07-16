import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";
import { isDevBypassEnabled } from "@/lib/devBypass";
import { resolveTenantFromHost } from "./tenantResolution";
import { HttpError } from "./errors";

/**
 * DEV-ONLY escape hatch: lets the app run on localhost before a real Clerk
 * account exists. Requires DEV_BYPASS_AUTH=true AND NODE_ENV=development —
 * either condition failing means this is never reachable, so there is no
 * path for this to activate in a deployed environment. Never set
 * DEV_BYPASS_AUTH outside a local .env.local file. Short-circuits entirely
 * before any Clerk/host/Membership lookup — reads DEV_BYPASS_ROLE/
 * DEV_BYPASS_TENANT_ID/DEV_BYPASS_LOCATION_ID directly from env.
 */
function devBypassContext(): RequestContext | null {
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

export async function getRequestContext(): Promise<RequestContext> {
  const devCtx = devBypassContext();
  if (devCtx) return devCtx;

  const { userId } = await auth();
  if (!userId) {
    throw new HttpError(401, "Not authenticated");
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const resolvedTenant = await resolveTenantFromHost(host);

  // A user may hold at most one membership per tenant, plus optionally one
  // cross-tenant KICK_ADMIN membership (tenantId null). Runs before role/
  // tenant context is known (this IS how we determine it), so it must use
  // system/KICK_ADMIN authority — Membership has FORCE ROW LEVEL SECURITY
  // and no anonymous-read policy.
  const memberships = await withTenant(systemKickContext(), (tx) => tx.membership.findMany({ where: { clerkUserId: userId } }));

  const kickAdminMembership = memberships.find((m) => m.role === "KICK_ADMIN" && m.tenantId === null);
  if (kickAdminMembership) {
    return {
      tenantId: resolvedTenant?.id ?? null,
      role: "KICK_ADMIN",
      locationId: null,
      userId,
    };
  }

  if (!resolvedTenant) {
    throw new HttpError(404, "Unknown tenant for this host");
  }

  const membership = memberships.find((m) => m.tenantId === resolvedTenant.id);
  if (!membership) {
    throw new HttpError(403, "Forbidden");
  }

  return {
    tenantId: resolvedTenant.id,
    role: membership.role,
    locationId: membership.locationId,
    userId,
  };
}
