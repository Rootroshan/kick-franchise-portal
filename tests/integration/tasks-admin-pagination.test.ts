import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listTasksAdmin } from "@/server/modules/tasks/admin";
import type { AdminListQuery } from "@/lib/adminQuery";

/**
 * listTasksAdmin has two query paths: a database-paginated one (no status
 * filter — the common case) and an in-memory one for the derived
 * overdue/open/completed status filter, which Prisma can't push into `where`.
 * Both must return the same rows/total shape and respect page/limit.
 */
function query(overrides: Partial<AdminListQuery> = {}): AdminListQuery {
  return {
    page: 1,
    limit: 20,
    search: "",
    status: "",
    brand: "",
    sort: "createdAt",
    direction: "desc",
    raw: {},
    ...overrides,
  };
}

describe("listTasksAdmin pagination", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("paginates at the database level when no status filter is applied", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), async (tx) => {
      for (let i = 0; i < 5; i++) {
        const task = await tx.task.create({
          data: { tenantId: tenant.id, title: `Task ${i}`, createdBy: "seed" },
        });
        await tx.taskAssignment.create({
          data: { taskId: task.id, locationId: location.id, status: "OPEN" },
        });
      }
    });

    const page1 = await listTasksAdmin(kickCtx(), query({ limit: 2, page: 1 }));
    expect(page1.total).toBe(5);
    expect(page1.rows).toHaveLength(2);

    const page3 = await listTasksAdmin(kickCtx(), query({ limit: 2, page: 3 }));
    expect(page3.total).toBe(5);
    expect(page3.rows).toHaveLength(1);
  });

  it("filters and paginates correctly in-memory when a derived status filter is applied", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), async (tx) => {
      // 3 completed tasks, 2 open tasks.
      for (let i = 0; i < 3; i++) {
        const task = await tx.task.create({ data: { tenantId: tenant.id, title: `Done ${i}`, createdBy: "seed" } });
        await tx.taskAssignment.create({ data: { taskId: task.id, locationId: location.id, status: "COMPLETED" } });
      }
      for (let i = 0; i < 2; i++) {
        const task = await tx.task.create({ data: { tenantId: tenant.id, title: `Open ${i}`, createdBy: "seed" } });
        await tx.taskAssignment.create({ data: { taskId: task.id, locationId: location.id, status: "OPEN" } });
      }
    });

    const completed = await listTasksAdmin(kickCtx(), query({ status: "completed" }));
    expect(completed.total).toBe(3);
    expect(completed.rows.every((r) => r.completed === r.total && r.total > 0)).toBe(true);

    const open = await listTasksAdmin(kickCtx(), query({ status: "open" }));
    expect(open.total).toBe(2);
    expect(open.rows.every((r) => r.completed < r.total)).toBe(true);
  });

  it("does not leak another tenant's tasks", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) => tx.task.create({ data: { tenantId: b.tenant.id, title: "B-only", createdBy: "seed" } }));

    const result = await listTasksAdmin(kickCtx(), query({ brand: a.tenant.slug }));
    expect(result.rows.find((r) => r.title === "B-only")).toBeUndefined();
  });
});
