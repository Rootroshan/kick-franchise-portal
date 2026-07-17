import { withTenant, type RequestContext } from "@/server/db/withTenant";

export type NotificationsOverview = {
  subs: { total: number; sent: number; pending: number; failed: number };
  recentFailures: Array<{ id: string; endpoint: string; lastError: string | null; brandName: string | null; updatedAt: Date }>;
  signals: {
    overdueTasks: number;
    scheduledAnnouncements: number;
    pendingAckAnnouncements: number;
  };
};

/** Push-notification health + operational signals worth notifying on. KICK_ADMIN only. */
export async function getNotificationsOverview(ctx: RequestContext): Promise<NotificationsOverview> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [total, sent, pending, failed, failures, tasks, scheduledAnnouncements, ackAnnouncements] = await Promise.all([
      tx.pushSubscription.count(),
      tx.pushSubscription.count({ where: { status: "SENT" } }),
      tx.pushSubscription.count({ where: { status: "PENDING" } }),
      tx.pushSubscription.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
      tx.pushSubscription.findMany({
        where: { status: { in: ["FAILED", "DEAD"] } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: { tenant: { select: { name: true } } },
      }),
      tx.task.findMany({ where: { dueAt: { lt: now } }, select: { dueAt: true, assignments: { select: { status: true } } } }),
      tx.announcement.count({ where: { status: "SCHEDULED" } }),
      tx.announcement.count({ where: { requiresAck: true, status: "PUBLISHED" } }),
    ]);

    const overdueTasks = tasks.filter((t) => {
      const tot = t.assignments.length;
      const done = t.assignments.filter((a) => a.status === "COMPLETED").length;
      return tot > 0 && done < tot;
    }).length;

    return {
      subs: { total, sent, pending, failed },
      recentFailures: failures.map((f) => ({
        id: f.id,
        endpoint: f.endpoint,
        lastError: f.lastError,
        brandName: f.tenant?.name ?? null,
        updatedAt: f.updatedAt,
      })),
      signals: { overdueTasks, scheduledAnnouncements, pendingAckAnnouncements: ackAnnouncements },
    };
  });
}

/** Badge count for the sidebar: failed pushes + operational signals needing attention. */
export async function getNotificationBadgeCount(ctx: RequestContext): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [failed, tasks] = await Promise.all([
      tx.pushSubscription.count({ where: { status: "FAILED" } }),
      tx.task.findMany({ where: { dueAt: { lt: now } }, select: { assignments: { select: { status: true } } } }),
    ]);
    const overdue = tasks.filter((t) => t.assignments.length > 0 && t.assignments.some((a) => a.status !== "COMPLETED")).length;
    return failed + overdue;
  });
}
