import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { createTask, listFranchiseeAssignments, completeTaskAssignment } from "@/server/modules/tasks/service";
import { sendOverdueTaskReminders } from "../../worker/jobs/tasks";
import { deriveTaskState } from "@/lib/taskState";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * Full task lifecycle: admin creates → per-store assignments → store users
 * see only their own → completion is per-store and idempotent → overdue
 * reminders fire exactly once per assignment.
 */

async function seedTenantWithTwoStores() {
  const { tenant, location } = await seedTenantWithLocation();
  const storeB = await withTenant(kickCtx(), (tx) =>
    tx.location.create({ data: { tenantId: tenant.id, name: "Test Store #2" } })
  );
  return { tenant, storeA: location, storeB };
}

describe("task lifecycle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates one Task and one TaskAssignment per selected store", async () => {
    const { tenant, storeA, storeB } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Safety inspection",
      details: "Monthly walkthrough",
      dueAt: new Date(Date.now() + 86_400_000),
      locationIds: [storeA.id, storeB.id],
    });

    expect(task.assignments).toHaveLength(2);
    expect(new Set(task.assignments.map((a) => a.locationId))).toEqual(new Set([storeA.id, storeB.id]));
    expect(task.assignments.every((a) => a.status === "OPEN")).toBe(true);
  });

  it("rejects stores that belong to another tenant", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    await expect(
      createTask(franchisorCtx(a.tenant.id), a.tenant.id, {
        title: "Cross-tenant",
        details: null,
        dueAt: null,
        locationIds: [a.location.id, b.location.id],
      })
    ).rejects.toThrowError(/do not belong/);
  });

  it("store users see only their own location's assignment", async () => {
    const { tenant, storeA, storeB } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Shared task",
      details: null,
      dueAt: null,
      locationIds: [storeA.id, storeB.id],
    });

    const seenByA = await listFranchiseeAssignments(franchiseeCtx(tenant.id, storeA.id, "user-a"));
    const seenByB = await listFranchiseeAssignments(franchiseeCtx(tenant.id, storeB.id, "user-b"));

    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(1);
    expect(seenByA[0]!.taskId).toBe(task.id);
    expect(seenByA[0]!.id).not.toBe(seenByB[0]!.id);
  });

  it("completing store A's assignment never touches store B's, and is idempotent", async () => {
    const { tenant, storeA, storeB } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Complete me",
      details: null,
      dueAt: null,
      locationIds: [storeA.id, storeB.id],
    });
    const assignmentA = task.assignments.find((a) => a.locationId === storeA.id)!;
    const assignmentB = task.assignments.find((a) => a.locationId === storeB.id)!;

    const ctxA = franchiseeCtx(tenant.id, storeA.id, "user-a");
    const completed = await completeTaskAssignment(ctxA, assignmentA.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedBy).toBe("user-a");
    expect(completed.completedAt).not.toBeNull();

    // Re-completing returns the existing completed state unchanged.
    const again = await completeTaskAssignment(ctxA, assignmentA.id);
    expect(again.completedAt?.getTime()).toBe(completed.completedAt?.getTime());
    expect(again.completedBy).toBe("user-a");

    const b = await withTenant(kickCtx(), (tx) => tx.taskAssignment.findUnique({ where: { id: assignmentB.id } }));
    expect(b?.status).toBe("OPEN");
    expect(b?.completedAt).toBeNull();
  });

  it("blocks completing another store's assignment (direct id manipulation)", async () => {
    const { tenant, storeA, storeB } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Isolation",
      details: null,
      dueAt: null,
      locationIds: [storeA.id],
    });
    const assignmentA = task.assignments[0]!;

    // A store-B user guessing store A's assignment id gets a 404, not a 403 —
    // no confirmation the id even exists.
    const ctxB = franchiseeCtx(tenant.id, storeB.id, "user-b");
    await expect(completeTaskAssignment(ctxB, assignmentA.id)).rejects.toThrowError(HttpError);
    await expect(completeTaskAssignment(ctxB, assignmentA.id)).rejects.toMatchObject({ status: 404 });

    const a = await withTenant(kickCtx(), (tx) => tx.taskAssignment.findUnique({ where: { id: assignmentA.id } }));
    expect(a?.status).toBe("OPEN");
  });

  it("admins cannot complete a store's assignment", async () => {
    const { tenant, storeA } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Role guard",
      details: null,
      dueAt: null,
      locationIds: [storeA.id],
    });
    await expect(completeTaskAssignment(franchisorCtx(tenant.id), task.assignments[0]!.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("task creation fans out in-app notifications linking to each store's own assignment", async () => {
    const { tenant, storeA, storeB } = await seedTenantWithTwoStores();
    await withTenant(kickCtx(), async (tx) => {
      await tx.membership.create({
        data: { clerkUserId: "user-a", tenantId: tenant.id, locationId: storeA.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      });
      await tx.membership.create({
        data: { clerkUserId: "user-b", tenantId: tenant.id, locationId: storeB.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      });
    });

    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Notify stores",
      details: null,
      dueAt: new Date(Date.now() + 86_400_000),
      locationIds: [storeA.id, storeB.id],
    });
    const assignmentA = task.assignments.find((a) => a.locationId === storeA.id)!;

    const notifications = await withTenant(kickCtx(), (tx) =>
      tx.notification.findMany({ where: { tenantId: tenant.id, category: "TASK" } })
    );
    expect(notifications).toHaveLength(2);
    const forA = notifications.find((n) => n.clerkUserId === "user-a");
    expect(forA?.href).toBe(`/tasks/${assignmentA.id}`);
    expect(forA?.title).toBe("New task assigned");
    expect(forA?.body).toMatch(/Notify stores is due /);
  });

  it("sends exactly one overdue reminder per assignment, with an in-app notification", async () => {
    const { tenant, storeA } = await seedTenantWithTwoStores();
    await withTenant(kickCtx(), (tx) =>
      tx.membership.create({
        data: { clerkUserId: "user-a", tenantId: tenant.id, locationId: storeA.id, role: "FRANCHISEE_USER", storeRole: "USER" },
      })
    );
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Already late",
      details: null,
      dueAt: new Date(Date.now() - 3_600_000),
      locationIds: [storeA.id],
    });
    const assignment = task.assignments[0]!;

    const first = await sendOverdueTaskReminders();
    expect(first.remindersSent).toBe(1);

    const stamped = await withTenant(kickCtx(), (tx) => tx.taskAssignment.findUnique({ where: { id: assignment.id } }));
    expect(stamped?.reminderSentAt).not.toBeNull();

    const reminders = await withTenant(kickCtx(), (tx) =>
      tx.notification.findMany({ where: { clerkUserId: "user-a", entity: "TaskAssignmentOverdue" } })
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.href).toBe(`/tasks/${assignment.id}`);

    // Second hourly run: nothing new to remind.
    const second = await sendOverdueTaskReminders();
    expect(second.remindersSent).toBe(0);
    const still = await withTenant(kickCtx(), (tx) =>
      tx.notification.findMany({ where: { clerkUserId: "user-a", entity: "TaskAssignmentOverdue" } })
    );
    expect(still).toHaveLength(1);
  });

  it("completed assignments are excluded from overdue reminders", async () => {
    const { tenant, storeA } = await seedTenantWithTwoStores();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, {
      title: "Done before the sweep",
      details: null,
      dueAt: new Date(Date.now() - 3_600_000),
      locationIds: [storeA.id],
    });
    await completeTaskAssignment(franchiseeCtx(tenant.id, storeA.id, "user-a"), task.assignments[0]!.id);

    const result = await sendOverdueTaskReminders();
    expect(result.remindersSent).toBe(0);
  });
});

describe("deriveTaskState", () => {
  const now = new Date("2026-07-22T12:00:00");

  it("derives display states from status + dueAt against server time", () => {
    expect(deriveTaskState("COMPLETED", new Date("2026-07-10"), now)).toBe("completed");
    expect(deriveTaskState("OPEN", null, now)).toBe("upcoming");
    expect(deriveTaskState("OPEN", new Date("2026-07-18T09:00:00"), now)).toBe("overdue");
    expect(deriveTaskState("OPEN", new Date("2026-07-24T09:00:00"), now)).toBe("upcoming");
    // Due later today → due_today; due earlier today → already overdue.
    expect(deriveTaskState("OPEN", new Date("2026-07-22T18:00:00"), now)).toBe("due_today");
    expect(deriveTaskState("OPEN", new Date("2026-07-22T09:00:00"), now)).toBe("overdue");
  });
});
