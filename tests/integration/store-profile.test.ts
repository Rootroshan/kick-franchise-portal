import { describe, it, expect, beforeEach } from "vitest";
import { authPrisma } from "@/server/db/authClient";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { updateOwnProfile, changeOwnPassword } from "@/server/modules/identity/profile";
import { getOwnNotificationPrefs, setOwnNotificationPrefs } from "@/server/modules/notifications/prefs";
import { createNotification, notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { hashPassword, verifyPassword } from "@/server/auth/password";

/**
 * Store User self-service: My Account profile edit, logged-in password change,
 * and per-category notification opt-outs. The rules worth pinning: a member
 * can only ever touch their own row, can never escalate role/tenant/location,
 * and an opt-out genuinely suppresses delivery.
 */
describe("Store User profile self-service", () => {
  beforeEach(async () => {
    await resetDatabase();
    await authPrisma.user.deleteMany();
  });

  async function seedStoreUser(userId = "store-user-1") {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: {
          clerkUserId: userId,
          tenantId: tenant.id,
          locationId: location.id,
          role: "FRANCHISEE_USER",
          storeRole: "USER",
          displayName: "Original Name",
          email: "store@example.com",
        },
      })
    );
    return { tenant, location, userId };
  }

  it("updates the caller's own displayName and phone, with an audit trail", async () => {
    const { tenant, location, userId } = await seedStoreUser();
    await authPrisma.user.create({ data: { id: userId, email: "store@example.com" } });

    const ctx = franchiseeCtx(tenant.id, location.id, userId);
    await updateOwnProfile(ctx, { displayName: "New Name", phone: "416-555-0100" });

    const membership = await withTenant(kickCtx(), (tx) =>
      tx.membership.findFirst({ where: { clerkUserId: userId, tenantId: tenant.id } })
    );
    expect(membership?.displayName).toBe("New Name");

    const user = await authPrisma.user.findUnique({ where: { id: userId } });
    expect(user?.phone).toBe("416-555-0100");

    const audit = await authPrisma.auditLog.findFirst({ where: { action: "membership.profile_update", actorId: userId } });
    expect(audit?.tenantId).toBe(tenant.id);
  });

  it("rejects crafted input trying to change role/tenantId/locationId", async () => {
    const { tenant, location, userId } = await seedStoreUser();
    const ctx = franchiseeCtx(tenant.id, location.id, userId);

    await expect(
      updateOwnProfile(ctx, {
        displayName: "Sneaky",
        role: "KICK_ADMIN",
        tenantId: "other-tenant",
        locationId: null,
        storeRole: "MANAGER",
      })
    ).rejects.toThrow(); // .strict() Zod schema — unknown keys are rejected outright

    const membership = await withTenant(kickCtx(), (tx) =>
      tx.membership.findFirst({ where: { clerkUserId: userId, tenantId: tenant.id } })
    );
    // Nothing changed — not even displayName, since the whole payload was refused.
    expect(membership?.displayName).toBe("Original Name");
    expect(membership?.role).toBe("FRANCHISEE_USER");
    expect(membership?.locationId).toBe(location.id);
  });

  it("cannot update a membership in another tenant", async () => {
    const { tenant, userId } = await seedStoreUser();
    const other = await seedTenantWithLocation();

    // Context claims tenant B, where this user has no membership row.
    const ctx = franchiseeCtx(other.tenant.id, other.location.id, userId);
    await expect(updateOwnProfile(ctx, { displayName: "Hijacked" })).rejects.toThrow(/not found/i);

    const membership = await withTenant(kickCtx(), (tx) =>
      tx.membership.findFirst({ where: { clerkUserId: userId, tenantId: tenant.id } })
    );
    expect(membership?.displayName).toBe("Original Name");
  });

  it("rejects non-franchisee contexts", async () => {
    await seedStoreUser();
    await expect(updateOwnProfile(kickCtx(), { displayName: "Admin" })).rejects.toThrow(/forbidden/i);
  });

  describe("changeOwnPassword", () => {
    it("rejects a wrong current password and leaves the hash untouched", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      const originalHash = await hashPassword("correct-horse-battery");
      await authPrisma.user.create({ data: { id: userId, email: "store@example.com", passwordHash: originalHash } });

      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      const outcome = await changeOwnPassword(ctx, { currentPassword: "wrong-password!", newPassword: "a-new-long-password" });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.message).toMatch(/current password/i);

      const user = await authPrisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).toBe(originalHash);
    });

    it("changes the hash when the current password verifies, and audits it", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      const originalHash = await hashPassword("correct-horse-battery");
      await authPrisma.user.create({ data: { id: userId, email: "store@example.com", passwordHash: originalHash } });

      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      const outcome = await changeOwnPassword(ctx, { currentPassword: "correct-horse-battery", newPassword: "a-new-long-password" });
      expect(outcome.ok).toBe(true);

      const user = await authPrisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).not.toBe(originalHash);
      expect(await verifyPassword(user!.passwordHash!, "a-new-long-password")).toBe(true);
      // Never stored in the clear.
      expect(user?.passwordHash).not.toContain("a-new-long-password");

      const audit = await authPrisma.auditLog.findFirst({ where: { action: "user.password_change", actorId: userId } });
      expect(audit).toBeTruthy();
      expect(JSON.stringify(audit)).not.toContain("a-new-long-password");
    });

    it("rejects a weak new password without touching the account", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      await authPrisma.user.create({ data: { id: userId, email: "store@example.com", passwordHash: await hashPassword("correct-horse-battery") } });

      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      const outcome = await changeOwnPassword(ctx, { currentPassword: "correct-horse-battery", newPassword: "abc" });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.message).toMatch(/at least 8/i);
    });

    it("reports honestly when the account has no local password (OAuth-only)", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      await authPrisma.user.create({ data: { id: userId, email: "store@example.com", passwordHash: null } });

      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      const outcome = await changeOwnPassword(ctx, { currentPassword: "anything-at-all", newPassword: "a-new-long-password" });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.message).toMatch(/not enabled/i);
    });
  });

  describe("notification preferences", () => {
    it("defaults every category to on and persists an opt-out", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      const ctx = franchiseeCtx(tenant.id, location.id, userId);

      expect(await getOwnNotificationPrefs(ctx)).toEqual({ ANNOUNCEMENT: true, TASK: true, ONBOARDING: true, ORDER: true });

      await setOwnNotificationPrefs(ctx, { ANNOUNCEMENT: false });
      expect((await getOwnNotificationPrefs(ctx)).ANNOUNCEMENT).toBe(false);
      // Merge, not replace — the others stay on.
      expect((await getOwnNotificationPrefs(ctx)).TASK).toBe(true);
    });

    it("rejects unknown preference keys", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      await expect(setOwnNotificationPrefs(ctx, { SYSTEM: false })).rejects.toThrow();
    });

    it("suppresses delivery for an opted-out category but not others", async () => {
      const { tenant, location, userId } = await seedStoreUser();
      const ctx = franchiseeCtx(tenant.id, location.id, userId);
      await setOwnNotificationPrefs(ctx, { ANNOUNCEMENT: false });

      await createNotification(ctx, {
        clerkUserId: userId,
        tenantId: tenant.id,
        locationId: location.id,
        category: "ANNOUNCEMENT",
        title: "Muted",
        entity: "Announcement",
        entityId: "a-1",
      });
      await createNotification(ctx, {
        clerkUserId: userId,
        tenantId: tenant.id,
        locationId: location.id,
        category: "TASK",
        title: "Delivered",
        entity: "Task",
        entityId: "t-1",
      });

      const rows = await withTenant(kickCtx(), (tx) => tx.notification.findMany({ where: { clerkUserId: userId } }));
      expect(rows.map((r) => r.category)).toEqual(["TASK"]);
    });

    it("fan-out via notifyTenantMembers respects each member's opt-out", async () => {
      const { tenant, location, userId } = await seedStoreUser("opted-out-user");
      await withTenant(kickCtx(), (tx) =>
        tx.membership.create({
          data: { clerkUserId: "opted-in-user", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER", storeRole: "USER" },
        })
      );
      await setOwnNotificationPrefs(franchiseeCtx(tenant.id, location.id, userId), { ANNOUNCEMENT: false });

      await notifyTenantMembers(kickCtx(), {
        tenantId: tenant.id,
        role: "FRANCHISEE_USER",
        category: "ANNOUNCEMENT",
        title: "Big news",
        entity: "Announcement",
        entityId: "a-2",
      });

      const rows = await withTenant(kickCtx(), (tx) => tx.notification.findMany({ where: { entityId: "a-2" } }));
      expect(rows.map((r) => r.clerkUserId)).toEqual(["opted-in-user"]);
    });
  });
});
