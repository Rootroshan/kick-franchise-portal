import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { DateRange } from "./dateRange";

/**
 * Data-access layer for the franchisor dashboard. Every query is tenant-scoped
 * (RLS enforces it too) and touches ONLY non-commerce tables:
 * Location, Membership, Announcement, AnnouncementAck, Task, TaskAssignment,
 * OnboardingTemplate/Item/Progress, Asset, AuditLog, PushSubscription, Tenant.
 *
 * Aggregations use groupBy/count/aggregate — never load-all-then-count.
 * Everything runs in a single withTenant() transaction so the GUCs are set once.
 */

const ACTIVE = "active";

export type EngagementCounts = {
  activeStores: number;
  totalStores: number;
  brandAdmins: number;
  // announcements read
  ackDone: number;
  ackOpportunities: number;
  // tasks
  taskTotal: number;
  taskCompleted: number;
  taskOpen: number;
  taskOverdue: number;
  taskDueThisWeek: number;
  // onboarding
  onbTotal: number;
  onbDone: number;
  // artwork downloads (from audit log)
  artworkDownloads: number;
};

/** Counts for a window — used for both current and previous period. */
export async function periodCounts(ctx: RequestContext, tenantId: string, range: DateRange): Promise<EngagementCounts> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

    const [
      activeStores,
      totalStores,
      brandAdmins,
      requiredAnns,
      ackDone,
      taskAgg,
      onbTotal,
      onbDone,
      artworkDownloads,
    ] = await Promise.all([
      tx.location.count({ where: { tenantId, status: ACTIVE } }),
      tx.location.count({ where: { tenantId } }),
      tx.membership.count({ where: { tenantId, role: "FRANCHISOR_ADMIN" } }),
      // acknowledgement opportunities = (required announcements published in range) × (active stores)
      tx.announcement.count({ where: { tenantId, requiresAck: true, publishAt: { gte: range.start, lt: range.end } } }),
      tx.announcementAck.count({ where: { acknowledgedAt: { gte: range.start, lt: range.end }, announcement: { tenantId, requiresAck: true } } }),
      tx.taskAssignment.groupBy({
        by: ["status"],
        where: { task: { tenantId }, createdAt: { gte: range.start, lt: range.end } },
        _count: true,
      }),
      tx.onboardingProgress.count({ where: { item: { template: { tenantId } } } }),
      tx.onboardingProgress.count({ where: { item: { template: { tenantId } }, done: true } }),
      tx.auditLog.count({ where: { tenantId, action: "asset.download", createdAt: { gte: range.start, lt: range.end } } }),
    ]);

    // Overdue / due-this-week need a small extra pass (date logic on open assignments).
    const [taskOverdue, taskDueThisWeek, activeStoresForAck] = await Promise.all([
      tx.taskAssignment.count({ where: { task: { tenantId, dueAt: { lt: now } }, status: "OPEN" } }),
      tx.taskAssignment.count({ where: { task: { tenantId, dueAt: { gte: now, lt: weekAhead } }, status: "OPEN" } }),
      tx.location.count({ where: { tenantId, status: ACTIVE } }),
    ]);

    const taskCompleted = taskAgg.find((g) => g.status === "COMPLETED")?._count ?? 0;
    const taskOpen = taskAgg.find((g) => g.status === "OPEN")?._count ?? 0;
    const taskTotal = taskAgg.reduce((s, g) => s + g._count, 0);

    return {
      activeStores,
      totalStores,
      brandAdmins,
      ackDone,
      ackOpportunities: requiredAnns * activeStoresForAck,
      taskTotal,
      taskCompleted,
      taskOpen,
      taskOverdue,
      taskDueThisWeek,
      onbTotal,
      onbDone,
      artworkDownloads,
    };
  });
}

export type StoreEngagementRow = { id: string; name: string; ackDone: number; taskTotal: number; taskDone: number; onbTotal: number; onbDone: number };

/** Per-store engagement inputs for the Top Stores ranking. */
export async function storeEngagement(ctx: RequestContext, tenantId: string, range: DateRange): Promise<StoreEngagementRow[]> {
  return withTenant(ctx, async (tx) => {
    const locations = await tx.location.findMany({ where: { tenantId, status: ACTIVE }, select: { id: true, name: true } });
    const ids = locations.map((l) => l.id);
    if (ids.length === 0) return [];

    const [acks, tasks, onb] = await Promise.all([
      tx.announcementAck.groupBy({ by: ["locationId"], where: { locationId: { in: ids }, acknowledgedAt: { gte: range.start, lt: range.end } }, _count: true }),
      tx.taskAssignment.groupBy({ by: ["locationId", "status"], where: { locationId: { in: ids } }, _count: true }),
      tx.onboardingProgress.groupBy({ by: ["locationId", "done"], where: { locationId: { in: ids } }, _count: true }),
    ]);

    const ackMap = new Map(acks.map((a) => [a.locationId, a._count]));
    return locations.map((l) => {
      const lTasks = tasks.filter((t) => t.locationId === l.id);
      const taskTotal = lTasks.reduce((s, t) => s + t._count, 0);
      const taskDone = lTasks.find((t) => t.status === "COMPLETED")?._count ?? 0;
      const lOnb = onb.filter((o) => o.locationId === l.id);
      const onbTotal = lOnb.reduce((s, o) => s + o._count, 0);
      const onbDone = lOnb.find((o) => o.done)?._count ?? 0;
      return { id: l.id, name: l.name, ackDone: ackMap.get(l.id) ?? 0, taskTotal, taskDone, onbTotal, onbDone };
    });
  });
}

/** Brand + recent announcements/onboarding/activity/notifications, in one transaction. */
export async function dashboardEntities(ctx: RequestContext, tenantId: string) {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 14 * 86_400_000); // onboarding "stalled" after 14d inactivity

    const [brand, activeStores, brandAdmins, announcements, templates, activity, pushFailures] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, theme: true, createdAt: true, _count: { select: { locations: true } } } }),
      tx.location.count({ where: { tenantId, status: ACTIVE } }),
      tx.membership.count({ where: { tenantId, role: "FRANCHISOR_ADMIN" } }),
      tx.announcement.findMany({
        where: { tenantId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: { _count: { select: { acks: true } } },
      }),
      tx.onboardingTemplate.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { items: { include: { progress: { select: { done: true, doneAt: true, locationId: true } } } } },
      }),
      tx.auditLog.findMany({
        where: { tenantId, action: { notIn: ["order.refund", "order.paid", "order.failed"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      tx.pushSubscription.count({ where: { tenantId, status: { in: ["FAILED", "DEAD"] } } }),
    ]);

    return { brand, activeStores, brandAdmins, announcements, templates, activity, pushFailures, staleThreshold, now };
  });
}
