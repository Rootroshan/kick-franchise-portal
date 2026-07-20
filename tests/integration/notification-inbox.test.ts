import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markRead,
  markAllRead,
  notifyTenantMembers,
} from "@/server/modules/notifications/inbox";

/**
 * The notification badge previously counted live operational conditions
 * (overdue tasks + failed orders + unverified domains). Those have no read
 * state, so opening the notifications page could never clear the badge, and
 * the number disagreed with what the page displayed. These tests lock in the
 * inbox behaviour that replaced it.
 */
describe("Notification inbox", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("unread count drops when a notification is read", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ctx = franchiseeCtx(tenant.id, location.id, "user-a");

    await createNotification(ctx, {
      clerkUserId: "user-a",
      tenantId: tenant.id,
      category: "TASK",
      title: "New task",
      entity: "Task",
      entityId: "t1",
    });
    expect(await getUnreadCount(ctx)).toBe(1);

    const [item] = await listNotifications(ctx);
    await markRead(ctx, item!.id);

    expect(await getUnreadCount(ctx)).toBe(0);
  });

  it("markAllRead clears every unread row for that user", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ctx = franchiseeCtx(tenant.id, location.id, "user-a");

    for (const id of ["t1", "t2", "t3"]) {
      await createNotification(ctx, {
        clerkUserId: "user-a",
        tenantId: tenant.id,
        category: "TASK",
        title: `Task ${id}`,
        entity: "Task",
        entityId: id,
      });
    }
    expect(await getUnreadCount(ctx)).toBe(3);

    const cleared = await markAllRead(ctx);
    expect(cleared).toBe(3);
    expect(await getUnreadCount(ctx)).toBe(0);
  });

  it("one user cannot see or read another user's notifications", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ctxA = franchiseeCtx(tenant.id, location.id, "user-a");
    const ctxB = franchiseeCtx(tenant.id, location.id, "user-b");

    await createNotification(ctxA, {
      clerkUserId: "user-a",
      tenantId: tenant.id,
      category: "ANNOUNCEMENT",
      title: "For A only",
      entity: "Announcement",
      entityId: "a1",
    });

    // Same tenant AND same location — tenant scoping alone would leak here.
    expect(await getUnreadCount(ctxB)).toBe(0);
    expect(await listNotifications(ctxB)).toHaveLength(0);

    // B cannot mark A's row read even knowing its id.
    const [aRow] = await listNotifications(ctxA);
    await markRead(ctxB, aRow!.id);
    expect(await getUnreadCount(ctxA)).toBe(1); // still unread for A
  });

  it("createNotification de-duplicates the same event for the same user", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ctx = franchiseeCtx(tenant.id, location.id, "user-a");

    const payload = {
      clerkUserId: "user-a",
      tenantId: tenant.id,
      category: "ANNOUNCEMENT" as const,
      title: "Same announcement",
      entity: "Announcement",
      entityId: "a1",
    };
    await createNotification(ctx, payload);
    await createNotification(ctx, payload); // retry / duplicate event

    expect(await getUnreadCount(ctx)).toBe(1);
  });

  it("notifyTenantMembers fans out to that tenant's members only", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.membership.createMany({
        data: [
          { clerkUserId: "a-user", tenantId: a.tenant.id, locationId: a.location.id, role: "FRANCHISEE_USER" },
          { clerkUserId: "b-user", tenantId: b.tenant.id, locationId: b.location.id, role: "FRANCHISEE_USER" },
        ],
      })
    );

    const sent = await notifyTenantMembers(kickCtx(), {
      tenantId: a.tenant.id,
      role: "FRANCHISEE_USER",
      category: "ANNOUNCEMENT",
      title: "Tenant A only",
      entity: "Announcement",
      entityId: "ann-a",
    });
    expect(sent).toBe(1);

    // The other tenant's user got nothing.
    const bCtx = franchiseeCtx(b.tenant.id, b.location.id, "b-user");
    expect(await getUnreadCount(bCtx)).toBe(0);
  });
});
