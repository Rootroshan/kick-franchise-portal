import { describe, it, expect, beforeEach, vi } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { validatePortalLogin, validateAdminLogin } from "@/server/auth/loginValidation";

/**
 * Portal login authorisation.
 *
 * The role selector on the brand login is a filter, never a grant. These tests
 * pin that: picking a role you do not hold must be rejected, not honoured. They
 * also cover cross-tenant attempts, which are the highest-consequence failure
 * mode — one brand's user reaching another brand's portal.
 */

// resolveTenantFromHost is exercised for real elsewhere; here it is stubbed so
// each case can control which tenant a hostname maps to.
const hostToTenant = new Map<string, { id: string; name: string; theme: unknown; status: string }>();

vi.mock("@/server/modules/identity/tenantResolution", () => ({
  resolveTenantFromHost: async (host: string) => hostToTenant.get(host) ?? null,
}));

describe("Portal login validation", () => {
  beforeEach(async () => {
    await resetDatabase();
    hostToTenant.clear();
  });

  async function seedPortal() {
    const { tenant, location } = await seedTenantWithLocation();
    hostToTenant.set("portal.brand-a.com", {
      id: tenant.id,
      name: tenant.name,
      theme: {},
      status: "active",
    });
    return { tenant, location };
  }

  it("rejects an unknown host before touching credentials", async () => {
    const res = await validatePortalLogin("any-user", "not-a-portal.example", "FRANCHISEE_USER");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNKNOWN_DOMAIN");
  });

  it("admits a franchisor who picked the Franchise Admin portal", async () => {
    const { tenant } = await seedPortal();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "u-franchisor", tenantId: tenant.id, role: "FRANCHISOR_ADMIN" },
      })
    );

    const res = await validatePortalLogin("u-franchisor", "portal.brand-a.com", "FRANCHISOR_ADMIN");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.role).toBe("FRANCHISOR_ADMIN");
      expect(res.redirectTo).toBe("/franchisor");
    }
  });

  it("rejects a franchisee who picked the Franchise Admin portal", async () => {
    const { tenant, location } = await seedPortal();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: "u-franchisee",
          tenantId: tenant.id,
          locationId: location.id,
          role: "FRANCHISEE_USER",
        },
      })
    );

    // The selector must not be able to elevate.
    const res = await validatePortalLogin("u-franchisee", "portal.brand-a.com", "FRANCHISOR_ADMIN");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("WRONG_PORTAL");
      // /admin-login's specific "wrong door" message — safe to be specific
      // here because credentials + a membership on THIS tenant are already
      // confirmed; there's nothing left to leak by naming the right door.
      expect(res.message).toBe("This account does not have Franchise Admin access.");
    }
  });

  it("rejects a franchisor who picked the Store User portal", async () => {
    const { tenant } = await seedPortal();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "u-franchisor-2", tenantId: tenant.id, role: "FRANCHISOR_ADMIN" },
      })
    );

    const res = await validatePortalLogin("u-franchisor-2", "portal.brand-a.com", "FRANCHISEE_USER");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("WRONG_PORTAL");
      expect(res.message).toBe("This account does not have Store User access.");
    }
  });

  it("rejects a user from another brand without revealing they exist", async () => {
    const { tenant } = await seedPortal();
    const other = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: "u-other-brand",
          tenantId: other.tenant.id,
          locationId: other.location.id,
          role: "FRANCHISEE_USER",
        },
      })
    );

    const res = await validatePortalLogin("u-other-brand", "portal.brand-a.com", "FRANCHISEE_USER");
    expect(res.ok).toBe(false);
    // Reported as credentials, NOT "wrong brand" — the latter confirms the
    // account exists on another tenant.
    if (!res.ok) {
      expect(res.code).toBe("INVALID_CREDENTIALS");
      expect(res.message).not.toMatch(/brand|tenant|another/i);
    }
    expect(tenant.id).not.toBe(other.tenant.id);
  });

  it("rejects a franchisee with no store assigned", async () => {
    const { tenant } = await seedPortal();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "u-no-store", tenantId: tenant.id, locationId: null, role: "FRANCHISEE_USER" },
      })
    );

    const res = await validatePortalLogin("u-no-store", "portal.brand-a.com", "FRANCHISEE_USER");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("NO_STORE");
  });

  it("rejects a franchisee whose store is inactive", async () => {
    const { tenant, location } = await seedPortal();
    await withTenant(kickCtx(), async (tx) => {
      await tx.location.update({ where: { id: location.id }, data: { status: "inactive" } });
      await tx.membership.create({
        data: {
          clerkUserId: "u-inactive-store",
          tenantId: tenant.id,
          locationId: location.id,
          role: "FRANCHISEE_USER",
        },
      });
    });

    const res = await validatePortalLogin("u-inactive-store", "portal.brand-a.com", "FRANCHISEE_USER");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("INACTIVE_STORE");
  });

  it("sends a franchisee to the store portal root", async () => {
    const { tenant, location } = await seedPortal();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: "u-ok",
          tenantId: tenant.id,
          locationId: location.id,
          role: "FRANCHISEE_USER",
        },
      })
    );

    const res = await validatePortalLogin("u-ok", "portal.brand-a.com", "FRANCHISEE_USER");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.redirectTo).toBe("/");
      expect(res.locationId).toBe(location.id);
    }
  });

  it("the admin login admits only a platform-wide KICK_ADMIN", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.createMany({
        data: [
          { clerkUserId: "u-admin", tenantId: null, role: "KICK_ADMIN" },
          { clerkUserId: "u-tenant-user", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER" },
        ],
      })
    );

    expect((await validateAdminLogin("u-admin")).ok).toBe(true);
    // A tenant user must not reach the Super Admin surface.
    expect((await validateAdminLogin("u-tenant-user")).ok).toBe(false);
  });
});
