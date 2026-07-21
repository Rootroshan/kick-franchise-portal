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

    const toRow = (t: {
      id: string;
      title: string;
      dueAt: Date | null;
      createdAt: Date;
      tenant: { name: string; slug: string };
      assignments: { status: TaskStatus }[];
    }): TaskRow => {
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
    };

    // The status filter ("overdue"/"open"/"completed") is derived from
    // assignment completion, which Prisma can't push into `where` — so only
    // THAT case needs every matching row in memory to filter correctly.
    // Everything else (the common case: no status filter, or search/brand
    // filters alone) paginates at the database with skip/take, instead of
    // fetching every task unconditionally and slicing in memory.
    if (q.status === "overdue" || q.status === "completed" || q.status === "open") {
      const items = await tx.task.findMany({
        where,
        orderBy,
        include: { tenant: { select: { name: true, slug: true } }, assignments: { select: { status: true } } },
      });
      let rows = items.map(toRow);
      if (q.status === "overdue") rows = rows.filter((r) => r.isOverdue);
      else if (q.status === "completed") rows = rows.filter((r) => r.total > 0 && r.completed === r.total);
      else rows = rows.filter((r) => r.completed < r.total);

      const total = rows.length;
      const start = (q.page - 1) * q.limit;
      return { rows: rows.slice(start, start + q.limit), total };
    }

    const [items, total] = await Promise.all([
      tx.task.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } }, assignments: { select: { status: true } } },
      }),
      tx.task.count({ where }),
    ]);
    return { rows: items.map(toRow), total };
  });
}

export type TaskKpis = { total: number; overdue: number; completed: number; open: number };

export async function getTaskKpis(ctx: RequestContext): Promise<TaskKpis> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    // completed/open/overdue are still derived from assignment completion —
    // Prisma can't express that in `where` — but this reads only the two
    // columns actually needed (dueAt, assignment status), not full task rows,
    // same shape as before with a tighter select.
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
