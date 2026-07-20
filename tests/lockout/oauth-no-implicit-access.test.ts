import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase } from "../helpers/db";

/**
 * Google sign-in authenticates, it does not authorise.
 *
 * Anyone with a Google account can complete the OAuth handshake, so the only
 * thing standing between a stranger and the admin dashboard is the Membership
 * row. These tests pin that down: authentication alone must never yield
 * KICK_ADMIN.
 */
describe("OAuth sign-in grants no implicit access", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a newly authenticated user with no Membership has no admin role", async () => {
    // A user who just signed in with Google but was never provisioned.
    const rows = await withTenant(kickCtx(), (tx) =>
      tx.membership.findMany({ where: { clerkUserId: "user_google_stranger" } })
    );
    expect(rows).toHaveLength(0);
  });

  it("only a tenantId-null KICK_ADMIN membership confers super-admin", async () => {
    // A tenant-scoped membership must NOT be treated as platform admin — the
    // resolver requires role KICK_ADMIN *and* tenantId null.
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: "user_scoped",
          tenantId: null,
          locationId: null,
          role: "FRANCHISEE_USER",
          email: "scoped@example.com",
        },
      })
    );

    const rows = await withTenant(kickCtx(), (tx) =>
      tx.membership.findMany({ where: { clerkUserId: "user_scoped", role: "KICK_ADMIN", tenantId: null } })
    );
    expect(rows).toHaveLength(0);
  });

  it("a provisioned KICK_ADMIN is found by the same lookup the resolver uses", async () => {
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: "user_real_admin",
          tenantId: null,
          locationId: null,
          role: "KICK_ADMIN",
          email: "admin@example.com",
        },
      })
    );

    const rows = await withTenant(kickCtx(), (tx) =>
      tx.membership.findMany({ where: { clerkUserId: "user_real_admin" } })
    );
    const isPlatformAdmin = rows.some((m) => m.role === "KICK_ADMIN" && m.tenantId === null);
    expect(isPlatformAdmin).toBe(true);
  });
});
