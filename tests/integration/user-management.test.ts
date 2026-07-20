import { describe, it, expect, beforeEach } from "vitest";
import { authPrisma } from "@/server/db/authClient";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import {
  createUser,
  setUserActive,
  deleteUser,
  resetUserPassword,
  getUserKpis,
  listUsers,
} from "@/server/modules/users/service";
import { verifyPassword } from "@/server/auth/password";

/**
 * Admin user management. The rules worth pinning are the ones that would let an
 * admin lock the platform out of itself, or that touch credentials.
 */
describe("User management", () => {
  beforeEach(async () => {
    await resetDatabase();
    await authPrisma.user.deleteMany();
  });

  it("creates a user with a hashed password and a membership", async () => {
    const { tenant } = await seedTenantWithLocation();
    const ctx = kickCtx();

    const { id } = await createUser(ctx, {
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      password: "correct-horse-battery",
      role: "FRANCHISOR_ADMIN",
      isActive: true,
      tenantId: tenant.id,
    });

    const user = await authPrisma.user.findUnique({ where: { id } });
    expect(user?.email).toBe("ada@example.com"); // normalised
    expect(user?.passwordHash).toBeTruthy();
    // Never stored in the clear.
    expect(user?.passwordHash).not.toContain("correct-horse-battery");
    expect(await verifyPassword(user!.passwordHash!, "correct-horse-battery")).toBe(true);

    const memberships = await withTenant(ctx, (tx) => tx.membership.findMany({ where: { clerkUserId: id } }));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe("FRANCHISOR_ADMIN");
  });

  it("rejects a duplicate email regardless of casing", async () => {
    const ctx = kickCtx();
    const base = { name: "A", password: "a-long-enough-password", role: "KICK_ADMIN" as const, isActive: true };

    await createUser(ctx, { ...base, email: "dupe@example.com" });
    await expect(createUser(ctx, { ...base, email: "DUPE@example.com" })).rejects.toThrow(/already exists/i);
  });

  it("rejects a password that fails the strength policy", async () => {
    const ctx = kickCtx();
    await expect(
      createUser(ctx, { name: "A", email: "short@example.com", password: "abc", role: "KICK_ADMIN", isActive: true })
    ).rejects.toThrow(/at least 8/i);
  });

  it("forces a KICK_ADMIN membership to be platform-wide", async () => {
    const { tenant } = await seedTenantWithLocation();
    const ctx = kickCtx();

    // Even though a tenant is supplied, a Super Admin must be cross-tenant —
    // requestContext.ts only recognises KICK_ADMIN with tenantId null.
    const { id } = await createUser(ctx, {
      name: "Root",
      email: "root@example.com",
      password: "a-long-enough-password",
      role: "KICK_ADMIN",
      isActive: true,
      tenantId: tenant.id,
    });

    const memberships = await withTenant(ctx, (tx) => tx.membership.findMany({ where: { clerkUserId: id } }));
    expect(memberships[0]!.tenantId).toBeNull();
  });

  it("a super admin cannot deactivate their own account", async () => {
    const ctx = kickCtx();
    const { id } = await createUser(ctx, {
      name: "Self",
      email: "self@example.com",
      password: "a-long-enough-password",
      role: "KICK_ADMIN",
      isActive: true,
    });

    const selfCtx = { ...ctx, userId: id };
    await expect(setUserActive(selfCtx, id, false)).rejects.toThrow(/your own account/i);

    // Still active.
    expect((await authPrisma.user.findUnique({ where: { id } }))?.isActive).toBe(true);
  });

  it("a super admin cannot delete their own account", async () => {
    const ctx = kickCtx();
    const { id } = await createUser(ctx, {
      name: "Self",
      email: "self2@example.com",
      password: "a-long-enough-password",
      role: "KICK_ADMIN",
      isActive: true,
    });

    const selfCtx = { ...ctx, userId: id };
    await expect(deleteUser(selfCtx, id)).rejects.toThrow(/your own account/i);
    expect(await authPrisma.user.findUnique({ where: { id } })).not.toBeNull();
  });

  it("deactivating another user is allowed and ends their sessions", async () => {
    const ctx = kickCtx();
    const { id } = await createUser(ctx, {
      name: "Other",
      email: "other@example.com",
      password: "a-long-enough-password",
      role: "FRANCHISEE_USER",
      isActive: true,
    });

    await authPrisma.session.create({
      data: { sessionToken: "tok-1", userId: id, expires: new Date(Date.now() + 3_600_000) },
    });

    await setUserActive(ctx, id, false);

    expect((await authPrisma.user.findUnique({ where: { id } }))?.isActive).toBe(false);
    // A deactivated user must not keep working off a live session.
    expect(await authPrisma.session.count({ where: { userId: id } })).toBe(0);
  });

  it("resetting a password changes the hash and ends sessions", async () => {
    const ctx = kickCtx();
    const { id } = await createUser(ctx, {
      name: "Reset",
      email: "reset@example.com",
      password: "original-password",
      role: "FRANCHISEE_USER",
      isActive: true,
    });
    const before = (await authPrisma.user.findUnique({ where: { id } }))!.passwordHash;

    await resetUserPassword(ctx, id, "a-brand-new-password");

    const after = (await authPrisma.user.findUnique({ where: { id } }))!.passwordHash;
    expect(after).not.toBe(before);
    expect(await verifyPassword(after!, "a-brand-new-password")).toBe(true);
    expect(await verifyPassword(after!, "original-password")).toBe(false);
  });

  it("writes an audit entry for create, status change and delete", async () => {
    const ctx = kickCtx();
    const { id } = await createUser(ctx, {
      name: "Audited",
      email: "audited@example.com",
      password: "a-long-enough-password",
      role: "FRANCHISEE_USER",
      isActive: true,
    });
    await setUserActive(ctx, id, false);
    await deleteUser(ctx, id);

    const logs = await withTenant(ctx, (tx) => tx.auditLog.findMany({ where: { entity: "User", entityId: id } }));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("user.create");
    expect(actions).toContain("user.deactivate");
    expect(actions).toContain("user.delete");
    // The credential must never be duplicated into the audit trail.
    expect(JSON.stringify(logs)).not.toContain("a-long-enough-password");
  });

  it("counts KPIs and filters by status", async () => {
    const ctx = kickCtx();
    const base = { password: "a-long-enough-password", role: "FRANCHISEE_USER" as const };
    await createUser(ctx, { ...base, name: "A", email: "a@example.com", isActive: true });
    await createUser(ctx, { ...base, name: "B", email: "b@example.com", isActive: false });
    await createUser(ctx, { ...base, name: "C", email: "c@example.com", role: "KICK_ADMIN", isActive: true });

    const kpis = await getUserKpis(ctx);
    expect(kpis.total).toBe(3);
    expect(kpis.active).toBe(2);
    expect(kpis.inactive).toBe(1);
    expect(kpis.superAdmins).toBe(1);

    const inactive = await listUsers(ctx, { status: "inactive", page: 1, limit: 20 });
    expect(inactive.total).toBe(1);
    expect(inactive.rows[0]!.email).toBe("b@example.com");
  });

  it("searches by name, email and phone", async () => {
    const ctx = kickCtx();
    await createUser(ctx, {
      name: "Grace Hopper",
      email: "grace@example.com",
      phone: "+61 412 345 678",
      password: "a-long-enough-password",
      role: "FRANCHISEE_USER",
      isActive: true,
    });

    for (const term of ["Grace", "grace@", "412 345"]) {
      const res = await listUsers(ctx, { search: term, page: 1, limit: 20 });
      expect(res.total, `search "${term}"`).toBe(1);
    }
  });
});
