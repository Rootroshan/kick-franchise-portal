import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { resolveTenantFromHost } from "@/server/modules/identity/tenantResolution";
import { upsertMembership, removeMembership } from "@/server/modules/identity/membership";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Regression coverage for a class of bug found during Phase 3 development:
 * several "pre-context" reads/writes (tenant resolution, Membership mirror)
 * were using the bare `prisma` client instead of withTenant(systemKickContext()),
 * which meant they ALWAYS returned zero rows / were rejected under RLS —
 * i.e., tenant resolution and login itself were completely broken. These
 * tests prove the fixed code paths actually work against real RLS.
 */
describe("Bootstrap reads that must work before role/tenant context exists", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("resolves a tenant by subdomain slug even though no role/tenant context exists yet", async () => {
    const { tenant } = await seedTenantWithLocation();
    process.env.APP_BASE_DOMAIN = "portal.kickmedia.test";

    const resolved = await resolveTenantFromHost(`${tenant.slug}.portal.kickmedia.test`);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(tenant.id);
  });

  it("returns null (not a crash) for an unknown subdomain", async () => {
    process.env.APP_BASE_DOMAIN = "portal.kickmedia.test";
    const resolved = await resolveTenantFromHost("nonexistent-brand.portal.kickmedia.test");
    expect(resolved).toBeNull();
  });

  it("upserts and removes a Membership row via system authority (Clerk webhook path)", async () => {
    const { tenant } = await seedTenantWithLocation();

    const membership = await upsertMembership({
      clerkUserId: "clerk-user-1",
      tenantId: tenant.id,
      locationId: null,
      role: "FRANCHISOR_ADMIN",
      email: "test@example.com",
    });
    expect(membership.clerkUserId).toBe("clerk-user-1");

    const found = await withTenant(kickCtx(), (tx) =>
      tx.membership.findFirst({ where: { clerkUserId: "clerk-user-1", tenantId: tenant.id } })
    );
    expect(found).not.toBeNull();

    await removeMembership("clerk-user-1", tenant.id);
    const afterRemoval = await withTenant(kickCtx(), (tx) =>
      tx.membership.findFirst({ where: { clerkUserId: "clerk-user-1", tenantId: tenant.id } })
    );
    expect(afterRemoval).toBeNull();
  });

  it("removeMembership is idempotent (calling it twice does not throw)", async () => {
    const { tenant } = await seedTenantWithLocation();
    await upsertMembership({ clerkUserId: "clerk-user-2", tenantId: tenant.id, locationId: null, role: "FRANCHISEE_USER" });
    await removeMembership("clerk-user-2", tenant.id);
    await expect(removeMembership("clerk-user-2", tenant.id)).resolves.not.toThrow();
  });
});
