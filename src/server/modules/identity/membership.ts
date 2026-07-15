import { prisma } from "@/server/db/client";
import type { Role } from "@prisma/client";

/**
 * Mirrors an authenticated Clerk user into the local Membership table.
 * Called from the Clerk webhook (user/org membership events) and from an
 * admin-driven invite flow. RLS reads role/tenant/location from this mirror
 * via request context — never from Clerk metadata directly on each query.
 */
export async function upsertMembership(input: {
  clerkUserId: string;
  tenantId: string | null;
  locationId: string | null;
  role: Role;
  displayName?: string | null;
  email?: string | null;
}) {
  return prisma.membership.upsert({
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
  });
}

export async function removeMembership(clerkUserId: string, tenantId: string | null) {
  await prisma.membership
    .delete({
      where: {
        clerkUserId_tenantId: {
          clerkUserId,
          tenantId: tenantId ?? "",
        },
      },
    })
    .catch(() => {
      // Already absent — idempotent.
    });
}
