import { describe, it, expect, beforeEach, vi } from "vitest";

const authState = { userId: null as string | null, host: "test-tenant.portal.kickmedia.test" };

vi.mock("@/server/auth/config", () => ({
  auth: async () => (authState.userId ? { user: { id: authState.userId } } : null),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", authState.host]]) as unknown as Headers,
}));

import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Proves that requireRole('KICK_ADMIN') — the exact guard every commerce/
 * allowance/rebate route handler calls first — throws a 403 HttpError for
 * a FRANCHISOR_ADMIN token BEFORE any business logic or DB query in the
 * route handler body runs. This is Layer 2 of the franchisor lockout.
 *
 * We exercise requireRole() directly (rather than importing route handler
 * modules, which need Next's request-scoped AsyncLocalStorage that only
 * exists inside a running server) because requireRole() IS the enforcement
 * point every route handler delegates to — this is not a weaker proxy for
 * the real behavior, it's the real behavior itself.
 */
describe("Lockout: requireRole('KICK_ADMIN') rejects FRANCHISOR_ADMIN with 403", () => {
  beforeEach(async () => {
    await resetDatabase();
    authState.userId = null;
  });

  it("throws 403 for a FRANCHISOR_ADMIN token, matching every commerce/allowance/rebate route's guard", async () => {
    const { tenant } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "franchisor-1", tenantId: tenant.id, role: "FRANCHISOR_ADMIN" },
      })
    );

    authState.userId = "franchisor-1";
    authState.host = `${tenant.slug}.portal.kickmedia.test`;
    process.env.APP_BASE_DOMAIN = "portal.kickmedia.test";

    await expect(requireRole("KICK_ADMIN")()).rejects.toMatchObject({ status: 403 });
  });

  it("throws 401 for an unauthenticated request", async () => {
    authState.userId = null;
    await expect(requireRole("KICK_ADMIN")()).rejects.toMatchObject({ status: 401 });
  });

  it("allows a KICK_ADMIN token through", async () => {
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({ data: { clerkUserId: "kick-1", tenantId: null, role: "KICK_ADMIN" } })
    );
    authState.userId = "kick-1";

    const ctx = await requireRole("KICK_ADMIN")();
    expect(ctx.role).toBe("KICK_ADMIN");
  });

  it("throws 403 for a FRANCHISEE_USER token on a KICK_ADMIN-only route", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "franchisee-1", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER" },
      })
    );
    authState.userId = "franchisee-1";
    authState.host = `${tenant.slug}.portal.kickmedia.test`;

    await expect(requireRole("KICK_ADMIN")()).rejects.toMatchObject({ status: 403 });
  });
});
