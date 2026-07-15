import { withTenant, systemKickContext } from "@/server/db/withTenant";
import type { Role } from "@prisma/client";

/**
 * Mirrors an authenticated Clerk user into the local Membership table.
 * Called from the Clerk webhook (user/org membership events) and from an
 * admin-driven invite flow. RLS reads role/tenant/location from this mirror
 * via request context — never from Clerk metadata directly on each query.
 *
 * Runs with system/KICK_ADMIN authority: Membership has FORCE ROW LEVEL
 * SECURITY and only KICK_ADMIN may INSERT/UPDATE it directly (franchisee/
 * franchisor mirroring is Kick-controlled, driven by the webhook, not
 * self-service).
 */
export async function upsertMembership(input: {
  clerkUserId: string;
  tenantId: string | null;
  locationId: string | null;
  role: Role;
  displayName?: string | null;
  email?: string | null;
}) {
  return withTenant(systemKickContext(), (tx) =>
    tx.membership.upsert({
      where: {
        clerkUserId_tenantId: {
          clerkUserId: input.clerkUserId,
          tenantId: input.tenantId ?? "",
        },
      },
      create: {
        clerkUserId: input.clerkUserId,
        tenantId: input.tenantId,
        locationId: input.locationId,
        role: input.role,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
      },
      update: {
        locationId: input.locationId,
        role: input.role,
        displayName: input.displayName ?? undefined,
        email: input.email ?? undefined,
      },
    })
  );
}

export async function removeMembership(clerkUserId: string, tenantId: string | null) {
  await withTenant(systemKickContext(), (tx) =>
    tx.membership.delete({
      where: {
        clerkUserId_tenantId: {
          clerkUserId,
          tenantId: tenantId ?? "",
        },
      },
    })
  ).catch(() => {
    // Already absent — idempotent.
  });
}
