import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";
import { devBypassContext } from "@/lib/devBypass";
import { resolveTenantFromHost } from "./tenantResolution";
import { HttpError } from "./errors";

export async function getRequestContext(): Promise<RequestContext> {
  // DEV-ONLY short-circuit; see src/lib/devBypass.ts — returns null (and this
  // is a no-op) in every deployed build.
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
