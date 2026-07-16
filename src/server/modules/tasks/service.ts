import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createTaskSchema } from "./schemas";

/** [K,F]: create a task and assign it to one or more locations in one call. */
export async function createTask(ctx: RequestContext, tenantId: string, input: z.infer<typeof createTaskSchema>) {
  return withTenant(ctx, async (tx) => {
    const locations = await tx.location.findMany({ where: { id: { in: input.locationIds }, tenantId } });
    if (locations.length !== input.locationIds.length) {
      throw new HttpError(422, "One or more locations do not belong to this tenant");
    }

    const task = await tx.task.create({
      data: {
        tenantId,
        title: input.title,
        details: input.details ?? null,
        dueAt: input.dueAt ?? null,
        createdBy: ctx.userId,
        assignments: {
          create: locations.map((l) => ({ locationId: l.id })),
        },
      },
      include: { assignments: true },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "task.create",
      entity: "Task",
      entityId: task.id,
      after: { title: task.title, locationCount: locations.length },
    });

    return task;
  });
}

/** [K,F,U]: franchisee sees only assignments for their own location; admins see all with per-location breakdown. */
export async function listTasks(ctx: RequestContext, tenantId: string | null) {
  return withTenant(ctx, (tx) => {
    if (ctx.role === "FRANCHISEE_USER") {
      return tx.task.findMany({
        where: { tenantId: tenantId ?? undefined, assignments: { some: { locationId: ctx.locationId! } } },
        include: { assignments: { where: { locationId: ctx.locationId! } } },
        orderBy: { dueAt: "asc" },
      });
    }
    return tx.task.findMany({
      where: { tenantId: tenantId ?? undefined },
      include: { assignments: { include: { location: true } } },
      orderBy: { dueAt: "asc" },
    });
  });
}

/**
 * [U]: marks ONE location's assignment complete. Completing one store's
 * assignment must never affect another's (spec §10.3 acceptance criteria) —
 * enforced simply by scoping the update to this specific TaskAssignment row.
 */
export async function completeTaskAssignment(ctx: RequestContext, assignmentId: string) {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users complete task assignments");
  }
  return withTenant(ctx, async (tx) => {
    const assignment = await tx.taskAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.locationId !== ctx.locationId) {
      throw new HttpError(404, "Task assignment not found");
    }
    if (assignment.status === "COMPLETED") {
      return assignment; // idempotent
    }

    return tx.taskAssignment.update({
      where: { id: assignmentId },
      data: { status: "COMPLETED", completedAt: new Date(), completedBy: ctx.userId },
    });
  });
}

/** Completion stats per location for a given task, for admin dashboards. */
export async function getTaskCompletionStats(ctx: RequestContext, taskId: string) {
  return withTenant(ctx, async (tx) => {
    const assignments = await tx.taskAssignment.findMany({ where: { taskId }, include: { location: true } });
    const completed = assignments.filter((a) => a.status === "COMPLETED");
    return {
      total: assignments.length,
      completed: completed.length,
      percentComplete: assignments.length ? Math.round((completed.length / assignments.length) * 100) : 0,
      assignments: assignments.map((a) => ({
        locationId: a.locationId,
        locationName: a.location.name,
        status: a.status,
        completedAt: a.completedAt,
      })),
    };
  });
}
