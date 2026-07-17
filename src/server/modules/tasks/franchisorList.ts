import { TaskStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

export type FranchisorTaskRow = {
  id: string;
  title: string;
  dueAt: Date | null;
  total: number;
  completed: number;
  isOverdue: boolean;
  createdBy: string;
};

export type TaskListResult = { rows: FranchisorTaskRow[]; total: number; counts: { all: number; open: number; completed: number; overdue: number; dueThisWeek: number } };

/** Tenant-scoped task list with per-task progress + tab counts + derived status filter. */
export async function listFranchisorTasks(ctx: RequestContext, tenantId: string, q: AdminListQuery): Promise<TaskListResult> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

    const tasks = await tx.task.findMany({
      where: { tenantId, ...(q.search ? { title: { contains: q.search, mode: "insensitive" as const } } : {}) },
      orderBy: q.sort === "title" ? { title: q.direction } : { dueAt: q.direction },
      include: { assignments: { select: { status: true } } },
    });

    const mapped = tasks.map((t) => {
      const total = t.assignments.length;
      const completed = t.assignments.filter((a) => a.status === TaskStatus.COMPLETED).length;
      const isOverdue = !!t.dueAt && t.dueAt < now && completed < total;
      const isDone = total > 0 && completed === total;
      const dueThisWeek = !!t.dueAt && t.dueAt >= now && t.dueAt < weekAhead && !isDone;
      return { id: t.id, title: t.title, dueAt: t.dueAt, total, completed, isOverdue, createdBy: t.createdBy, isDone, dueThisWeek };
    });

    const counts = {
      all: mapped.length,
      open: mapped.filter((m) => !m.isDone).length,
      completed: mapped.filter((m) => m.isDone).length,
      overdue: mapped.filter((m) => m.isOverdue).length,
      dueThisWeek: mapped.filter((m) => m.dueThisWeek).length,
    };

    let filtered = mapped;
    if (q.status === "open") filtered = mapped.filter((m) => !m.isDone);
    else if (q.status === "completed") filtered = mapped.filter((m) => m.isDone);
    else if (q.status === "overdue") filtered = mapped.filter((m) => m.isOverdue);
    else if (q.status === "due_this_week") filtered = mapped.filter((m) => m.dueThisWeek);

    const total = filtered.length;
    const start = (q.page - 1) * q.limit;
    const rows = filtered.slice(start, start + q.limit).map(({ isDone: _isDone, dueThisWeek: _d, ...r }) => r);
    return { rows, total, counts };
  });
}

export type TaskDetail = {
  id: string;
  title: string;
  details: string | null;
  dueAt: Date | null;
  createdBy: string;
  createdAt: Date;
  assignments: Array<{ id: string; storeName: string; status: string; completedAt: Date | null; completedBy: string | null }>;
};

export async function getFranchisorTask(ctx: RequestContext, tenantId: string, id: string): Promise<TaskDetail> {
  return withTenant(ctx, async (tx) => {
    const t = await tx.task.findFirst({
      where: { id, tenantId },
      include: { assignments: { include: { location: { select: { name: true } } }, orderBy: { createdAt: "asc" } } },
    });
    if (!t) throw new HttpError(404, "Task not found");
    return {
      id: t.id,
      title: t.title,
      details: t.details,
      dueAt: t.dueAt,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
      assignments: t.assignments.map((a) => ({ id: a.id, storeName: a.location.name, status: a.status, completedAt: a.completedAt, completedBy: a.completedBy })),
    };
  });
}

/** Active stores for the task-assignment picker. */
export async function listAssignableStores(ctx: RequestContext, tenantId: string): Promise<Array<{ id: string; name: string }>> {
  return withTenant(ctx, (tx) => tx.location.findMany({ where: { tenantId, status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } }));
}
