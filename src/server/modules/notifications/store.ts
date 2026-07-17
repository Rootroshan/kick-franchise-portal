import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * Store-scoped notification feed for a FRANCHISEE_USER. Derived live from the
 * store's own data (unacknowledged announcements, open/overdue tasks, recent
 * orders). NEVER shows another location's data or any commerce-admin/rebate
 * info. There is no persisted per-user notification table yet, so read/unread
 * is not stored — documented in the README.
 */
export type StoreNotification = {
  id: string;
  category: "announcement" | "task_due" | "task_overdue" | "order" | "onboarding";
  message: string;
  createdAt: Date;
  href: string;
};

export async function getStoreNotifications(ctx: RequestContext): Promise<StoreNotification[]> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users have store notifications");
  }
  const locationId = ctx.locationId;
  const tenantId = ctx.tenantId ?? undefined;

  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86_400_000);

    const [unackedAnns, openAssignments, recentOrders] = await Promise.all([
      tx.announcement.findMany({
        where: { tenantId, status: "PUBLISHED", requiresAck: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], acks: { none: { clerkUserId: ctx.userId } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      tx.taskAssignment.findMany({
        where: { locationId, status: "OPEN", task: { dueAt: { not: null } } },
        include: { task: { select: { id: true, title: true, dueAt: true } } },
        take: 20,
      }),
      tx.order.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true } }),
    ]);

    const out: StoreNotification[] = [];

    for (const a of unackedAnns) {
      out.push({ id: `ann-${a.id}`, category: "announcement", message: `Please acknowledge: ${a.title}`, createdAt: a.createdAt, href: `/announcements/${a.id}` });
    }
    for (const asg of openAssignments) {
      const due = asg.task.dueAt!;
      const overdue = due < now;
      if (overdue) out.push({ id: `task-${asg.id}`, category: "task_overdue", message: `Overdue task: ${asg.task.title}`, createdAt: due, href: `/tasks/${asg.id}` });
      else if (due < soon) out.push({ id: `task-${asg.id}`, category: "task_due", message: `Task due soon: ${asg.task.title}`, createdAt: due, href: `/tasks/${asg.id}` });
    }
    for (const o of recentOrders) {
      if (o.status === "PAID" || o.status === "FULFILLED") {
        out.push({ id: `order-${o.id}`, category: "order", message: `Order #${o.id.slice(0, 8)} is ${o.status.toLowerCase()}`, createdAt: o.createdAt, href: `/orders/${o.id}` });
      }
    }

    return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });
}
