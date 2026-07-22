import type { TaskStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { HttpError } from "@/server/modules/identity/errors";
import { formatDate } from "@/lib/utils";
import { sendPushToLocationMembers } from "../../../../worker/push/send";
import type { z } from "zod";
import type { createTaskSchema } from "./schemas";

/** [K,F]: create a task and assign it to one or more locations in one call. */
export async function createTask(ctx: RequestContext, tenantId: string, input: z.infer<typeof createTaskSchema>) {
  const { task, locations } = await withTenant(ctx, async (tx) => {
    const locs = await tx.location.findMany({ where: { id: { in: input.locationIds }, tenantId } });
    if (locs.length !== input.locationIds.length) {
      throw new HttpError(422, "One or more locations do not belong to this tenant");
    }

    const created = await tx.task.create({
      data: {
        tenantId,
        title: input.title,
        details: input.details ?? null,
        dueAt: input.dueAt ?? null,
        createdBy: ctx.userId,
        assignments: {
          create: locs.map((l) => ({ locationId: l.id })),
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
      entityId: created.id,
      after: { title: created.title, locationCount: locs.length },
    });

    return { task: created, locations: locs };
  });

  // Notify each assigned store's users after commit. One notification per
  // location so a user only hears about their own store's work, and each
  // links to that store's OWN assignment detail page — the dedupe key
  // (entity=TaskAssignment) keeps a worker retry from double-notifying.
  const body = task.dueAt ? `${task.title} is due ${formatDate(task.dueAt)}.` : task.title;
  const assignmentByLocation = new Map(task.assignments.map((a) => [a.locationId, a.id]));
  for (const loc of locations) {
    const assignmentId = assignmentByLocation.get(loc.id)!;
    await notifyTenantMembers(ctx, {
      tenantId,
      locationId: loc.id,
      role: "FRANCHISEE_USER",
      category: "TASK",
      title: "New task assigned",
      body,
      href: `/tasks/${assignmentId}`,
      entity: "TaskAssignment",
      entityId: assignmentId,
    }).catch(() => {
      // Inbox fan-out must never fail task creation.
    });
    await sendPushToLocationMembers(
      tenantId,
      { title: "New task assigned", body, url: `/tasks/${assignmentId}` },
      loc.id,
      "TASK"
    ).catch(() => {
      // Push delivery must never fail task creation either.
    });
  }

  return task;
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

export type FranchiseeAssignmentRow = {
  id: string;
  taskId: string;
  title: string;
  details: string | null;
  dueAt: Date | null;
  createdAt: Date;
  status: TaskStatus;
  completedAt: Date | null;
};

/**
 * [U]: every assignment for the caller's own location, assignment-major (the
 * Store User portal navigates by assignment id so completion stays scoped to
 * one store). Single query; summary counts and tab filters are derived from
 * this in the page — a store's assignment list is small.
 */
export async function listFranchiseeAssignments(ctx: RequestContext): Promise<FranchiseeAssignmentRow[]> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users have task assignments");
  }
  return withTenant(ctx, async (tx) => {
    const rows = await tx.taskAssignment.findMany({
      where: { locationId: ctx.locationId!, task: { tenantId: ctx.tenantId ?? undefined } },
      orderBy: [{ task: { dueAt: "asc" } }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        completedAt: true,
        task: { select: { id: true, title: true, details: true, dueAt: true, createdAt: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task.id,
      title: r.task.title,
      details: r.task.details,
      dueAt: r.task.dueAt,
      createdAt: r.task.createdAt,
      status: r.status,
      completedAt: r.completedAt,
    }));
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
