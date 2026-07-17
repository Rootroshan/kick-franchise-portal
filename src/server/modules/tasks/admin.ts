import { TaskStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type TaskRow = {
  id: string;
  title: string;
  brandName: string;
  brandSlug: string;
  dueAt: Date | null;
  total: number;
  completed: number;
  isOverdue: boolean;
  createdAt: Date;
};

export type TaskListResult = { rows: TaskRow[]; total: number };

/** Cross-tenant task list with per-task completion progress. KICK_ADMIN only.
 *  status filter: "overdue" | "open" | "completed" (derived from assignments). */
export async function listTasksAdmin(ctx: RequestContext, q: AdminListQuery): Promise<TaskListResult> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const where = {
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const orderBy = q.sort === "title" ? { title: q.direction } : q.sort === "dueAt" ? { dueAt: q.direction } : { createdAt: q.direction };

    const items = await tx.task.findMany({
      where,
      orderBy,
      include: { tenant: { select: { name: true, slug: true } }, assignments: { select: { status: true } } },
    });

    let rows: TaskRow[] = items.map((t) => {
      const total = t.assignments.length;
      const completed = t.assignments.filter((a) => a.status === TaskStatus.COMPLETED).length;
      const isOverdue = !!t.dueAt && t.dueAt < now && completed < total;
      return {
        id: t.id,
        title: t.title,
        brandName: t.tenant.name,
        brandSlug: t.tenant.slug,
        dueAt: t.dueAt,
        total,
        completed,
        isOverdue,
        createdAt: t.createdAt,
      };
    });

    // Derived status filter (assignment-based, so applied in memory).
    if (q.status === "overdue") rows = rows.filter((r) => r.isOverdue);
    else if (q.status === "completed") rows = rows.filter((r) => r.total > 0 && r.completed === r.total);
    else if (q.status === "open") rows = rows.filter((r) => r.completed < r.total);

    const total = rows.length;
    const start = (q.page - 1) * q.limit;
    return { rows: rows.slice(start, start + q.limit), total };
  });
}

export type TaskKpis = { total: number; overdue: number; completed: number; open: number };

export async function getTaskKpis(ctx: RequestContext): Promise<TaskKpis> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const tasks = await tx.task.findMany({ select: { dueAt: true, assignments: { select: { status: true } } } });
    let overdue = 0,
      completed = 0,
      open = 0;
    for (const t of tasks) {
      const tot = t.assignments.length;
      const done = t.assignments.filter((a) => a.status === TaskStatus.COMPLETED).length;
      if (tot > 0 && done === tot) completed++;
      else open++;
      if (t.dueAt && t.dueAt < now && done < tot) overdue++;
    }
    return { total: tasks.length, overdue, completed, open };
  });
}
