import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import type { RequestContext } from "@/server/db/withTenant";
import { resolveTenantFromHost } from "./tenantResolution";
import { HttpError } from "./errors";

/**
 * Builds the trusted per-request context:
 *   1. Verify Clerk session (server-side, never trust client claims).
 *   2. Resolve tenant from the Host header.
 *   3. Load the mirrored Membership row for this Clerk user.
 *   4. Confirm membership belongs to the resolved tenant, OR the user is a
 *      cross-tenant KICK_ADMIN.
 *
 * This never reads role/tenant from client-supplied headers, cookies, or
 * request bodies — only from the verified session + our own Membership
 * mirror + the Host header driven tenant lookup.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const { userId } = await auth();
  if (!userId) {
    throw new HttpError(401, "Not authenticated");
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const resolvedTenant = await resolveTenantFromHost(host);

  // A user may hold at most one membership per tenant, plus optionally one
  // cross-tenant KICK_ADMIN membership (tenantId null).
  const memberships = await prisma.membership.findMany({ where: { clerkUserId: userId } });

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
