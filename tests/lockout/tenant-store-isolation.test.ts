import { describe, it, expect, beforeEach, vi } from "vitest";

const authState = { userId: null as string | null, host: "test-tenant.portal.kickmedia.test" };

vi.mock("@/server/auth/config", () => ({
  auth: async () => (authState.userId ? { user: { id: authState.userId } } : null),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", authState.host]]) as unknown as Headers,
}));

import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { requireStoreAccess } from "@/server/modules/identity/guard";

/**
 * Membership.tenantId and Membership.locationId exist specifically so a
 * membership for tenant/store A can never authenticate against tenant/store
 * B. These tests target both boundaries directly — the other lockout tests
 * only cover role-based commerce lockout within the SAME tenant, not
 * cross-tenant or cross-store isolation.
 */
describe("Cross-tenant and cross-store isolation", () => {
  beforeEach(async () => {
    await resetDatabase();
    authState.userId = null;
    process.env.APP_BASE_DOMAIN = "portal.kickmedia.test";
  });

  it("a franchisor's Membership.tenantId does not grant access to a second brand's data", async () => {
    const brandA = await seedTenantWithLocation();
    const brandB = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: brandB.tenant.id, name: "Brand B Store" } }));

    const asBrandAFranchisor = await withTenant(franchisorCtx(brandA.tenant.id), (tx) =>
      tx.location.findMany({ where: { tenantId: brandB.tenant.id } })
    );
    expect(asBrandAFranchisor).toHaveLength(0);

    const asBrandBFranchisor = await withTenant(franchisorCtx(brandB.tenant.id), (tx) =>
      tx.location.findMany({ where: { tenantId: brandB.tenant.id } })
    );
    expect(asBrandBFranchisor.length).toBeGreaterThan(0);
  });

  it("a store's Location rows are only visible within their own tenantId, never a sibling brand's", async () => {
    const brandA = await seedTenantWithLocation();
    const brandB = await seedTenantWithLocation();

    const allAsKick = await withTenant(kickCtx(), (tx) =>
      tx.location.findMany({ where: { id: { in: [brandA.location.id, brandB.location.id] } } })
    );
    expect(allAsKick).toHaveLength(2);

    const brandAView = await withTenant(franchisorCtx(brandA.tenant.id), (tx) =>
      tx.location.findMany({ where: { id: { in: [brandA.location.id, brandB.location.id] } } })
    );
    expect(brandAView.map((l) => l.id)).toEqual([brandA.location.id]);
  });

  it("requireStoreAccess rejects a franchisee whose Membership.locationId points at a different store", async () => {
    const { tenant, location: storeA } = await seedTenantWithLocation();
    const storeB = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Store B" } }));

    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "franchisee-1", tenantId: tenant.id, locationId: storeA.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      })
    );

    authState.userId = "franchisee-1";
    authState.host = `${tenant.slug}.portal.kickmedia.test`;

    // Same tenant, wrong store: must be rejected even though the membership
    // and target share a brand.
    await expect(requireStoreAccess(storeB.id)()).rejects.toMatchObject({ status: 403 });
    // The user's own store must be granted.
    await expect(requireStoreAccess(storeA.id)()).resolves.toMatchObject({ locationId: storeA.id });
  });

  it("requireStoreAccess with requireManager rejects a plain store USER but allows a MANAGER", async () => {
    const { tenant, location: store } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "store-user-1", tenantId: tenant.id, locationId: store.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "store-mgr-1", tenantId: tenant.id, locationId: store.id, role: "FRANCHISEE_USER", storeRole: "MANAGER" },
      })
    );

    authState.host = `${tenant.slug}.portal.kickmedia.test`;

    authState.userId = "store-user-1";
    await expect(requireStoreAccess(store.id, { requireManager: true })()).rejects.toMatchObject({ status: 403 });

    authState.userId = "store-mgr-1";
    await expect(requireStoreAccess(store.id, { requireManager: true })()).resolves.toMatchObject({ storeRole: "MANAGER" });
  });

  it("a KICK_ADMIN passes requireStoreAccess for any store regardless of membership", async () => {
    const { location } = await seedTenantWithLocation();
    const unrelated = await seedTenantWithLocation();
    const otherStore = await withTenant(kickCtx(), (tx) =>
      tx.location.create({ data: { tenantId: unrelated.tenant.id, name: "Unrelated Store" } })
    );

    await withTenant(kickCtx(), (tx) => tx.membership.create({ data: { clerkUserId: "kick-1", tenantId: null, role: "KICK_ADMIN" } }));
    authState.userId = "kick-1";

    await expect(requireStoreAccess(location.id)()).resolves.toMatchObject({ role: "KICK_ADMIN" });
    await expect(requireStoreAccess(otherStore.id)()).resolves.toMatchObject({ role: "KICK_ADMIN" });
  });
});
