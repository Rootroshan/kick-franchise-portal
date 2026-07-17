import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { getStoreAllowances } from "@/server/modules/allowances/store";
import { getStoreNotifications } from "@/server/modules/notifications/store";

/**
 * Store-isolation coverage for the new franchisee leaf pages/services.
 * A FRANCHISEE_USER must only ever see their own location's data — RLS plus
 * explicit locationId scoping. Changing an id must not cross the boundary.
 */
describe("Store portal isolation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("getStoreAllowances returns only the caller's location", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    // A second store in the same tenant, with its own allowance.
    const other = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Store B" } }));
    await withTenant(kickCtx(), (tx) =>
      tx.allowance.createMany({
        data: [
          { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 10_000, createdBy: "seed" },
          { tenantId: tenant.id, locationId: other.id, periodLabel: "2026-Q3", grantedCents: 99_999, createdBy: "seed" },
        ],
      })
    );

    const mine = await getStoreAllowances(franchiseeCtx(tenant.id, location.id));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.grantedCents).toBe(10_000); // never sees Store B's 99,999
  });

  it("an order is invisible to another store in the same tenant", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const storeB = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Store B" } }));
    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({ data: { tenantId: tenant.id, locationId: location.id, status: "PAID", subtotalCents: 5000, idempotencyKey: "iso-1", placedBy: "u" } })
    );

    // Store B, scoping by its own location (mirrors the page query), sees nothing.
    const seenByB = await withTenant(franchiseeCtx(tenant.id, storeB.id), (tx) =>
      tx.order.findFirst({ where: { id: order.id, locationId: storeB.id } })
    );
    expect(seenByB).toBeNull();
  });

  it("a task assignment is invisible to another store", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const storeB = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Store B" } }));
    const task = await withTenant(kickCtx(), (tx) =>
      tx.task.create({ data: { tenantId: tenant.id, title: "Clean", createdBy: "u", assignments: { create: [{ locationId: location.id }] } }, include: { assignments: true } })
    );
    const assignmentId = task.assignments[0]!.id;

    const seenByB = await withTenant(franchiseeCtx(tenant.id, storeB.id), (tx) =>
      tx.taskAssignment.findFirst({ where: { id: assignmentId, locationId: storeB.id } })
    );
    expect(seenByB).toBeNull();
  });

  it("notifications never surface another location's tasks", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const storeB = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenant.id, name: "Store B" } }));
    const past = new Date(Date.now() - 86_400_000);
    // Overdue task assigned ONLY to store B.
    await withTenant(kickCtx(), (tx) =>
      tx.task.create({ data: { tenantId: tenant.id, title: "B overdue", dueAt: past, createdBy: "u", assignments: { create: [{ locationId: storeB.id }] } } })
    );

    const notifs = await getStoreNotifications(franchiseeCtx(tenant.id, location.id));
    expect(notifs.find((n) => n.message.includes("B overdue"))).toBeUndefined();
  });

  it("getStoreAllowances rejects a non-franchisee", async () => {
    const { tenant } = await seedTenantWithLocation();
    await expect(getStoreAllowances({ ...kickCtx(), tenantId: tenant.id })).rejects.toThrow();
  });
});
