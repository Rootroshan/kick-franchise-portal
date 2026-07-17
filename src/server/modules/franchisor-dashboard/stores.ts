import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { safePercent, storeScore } from "./calculations";

export type FranchisorStoreRow = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  members: number;
  score: number;
};

/** Tenant-scoped store list with engagement score (no commerce metrics). */
export async function listFranchisorStores(ctx: RequestContext, tenantId: string): Promise<FranchisorStoreRow[]> {
  return withTenant(ctx, async (tx) => {
    const locations = await tx.location.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, status: true, _count: { select: { memberships: true } } },
    });
    const ids = locations.map((l) => l.id);
    if (ids.length === 0) return [];

    const [acks, tasks, onb] = await Promise.all([
      tx.announcementAck.groupBy({ by: ["locationId"], where: { locationId: { in: ids } }, _count: true }),
      tx.taskAssignment.groupBy({ by: ["locationId", "status"], where: { locationId: { in: ids } }, _count: true }),
      tx.onboardingProgress.groupBy({ by: ["locationId", "done"], where: { locationId: { in: ids } }, _count: true }),
    ]);
    const ackSet = new Set(acks.filter((a) => a._count > 0).map((a) => a.locationId));

    return locations.map((l) => {
      const lTasks = tasks.filter((t) => t.locationId === l.id);
      const taskTotal = lTasks.reduce((s, t) => s + t._count, 0);
      const taskDone = lTasks.find((t) => t.status === "COMPLETED")?._count ?? 0;
      const lOnb = onb.filter((o) => o.locationId === l.id);
      const onbTotal = lOnb.reduce((s, o) => s + o._count, 0);
      const onbDone = lOnb.find((o) => o.done)?._count ?? 0;
      return {
        id: l.id,
        name: l.name,
        address: l.address,
        status: l.status,
        members: l._count.memberships,
        score: storeScore([
          { percent: ackSet.has(l.id) ? 100 : 0, available: true },
          { percent: safePercent(taskDone, taskTotal), available: taskTotal > 0 },
          { percent: safePercent(onbDone, onbTotal), available: onbTotal > 0 },
        ]),
      };
    });
  });
}

export type StoreSummary = { total: number; active: number; inactive: number; needsAttention: number };

/** Store summary cards (§12). "Needs attention" = active store with overdue tasks. */
export async function getStoreSummary(ctx: RequestContext, tenantId: string): Promise<StoreSummary> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [total, active, needsAttention] = await Promise.all([
      tx.location.count({ where: { tenantId } }),
      tx.location.count({ where: { tenantId, status: "active" } }),
      tx.taskAssignment.findMany({ where: { task: { tenantId, dueAt: { lt: now } }, status: "OPEN" }, select: { locationId: true }, distinct: ["locationId"] }),
    ]);
    return { total, active, inactive: total - active, needsAttention: needsAttention.length };
  });
}

export type StoreDetail = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  members: Array<{ id: string; name: string; email: string | null; role: string }>;
  openTasks: number;
  completedTasks: number;
  onboardingPercent: number;
  announcementAcks: number;
  artworkDownloads: number;
  score: number;
};

export async function getFranchisorStoreDetail(ctx: RequestContext, tenantId: string, storeId: string): Promise<StoreDetail | null> {
  return withTenant(ctx, async (tx) => {
    const store = await tx.location.findFirst({ where: { id: storeId, tenantId }, select: { id: true, name: true, address: true, status: true } });
    if (!store) return null;

    const [members, taskGroups, onb, acks, downloads] = await Promise.all([
      tx.membership.findMany({ where: { tenantId, locationId: storeId }, select: { id: true, displayName: true, email: true, role: true } }),
      tx.taskAssignment.groupBy({ by: ["status"], where: { locationId: storeId }, _count: true }),
      tx.onboardingProgress.groupBy({ by: ["done"], where: { locationId: storeId }, _count: true }),
      tx.announcementAck.count({ where: { locationId: storeId } }),
      tx.auditLog.count({ where: { tenantId, action: "asset.download", actorId: { in: (await tx.membership.findMany({ where: { locationId: storeId }, select: { clerkUserId: true } })).map((m) => m.clerkUserId) } } }),
    ]);

    const openTasks = taskGroups.find((g) => g.status === "OPEN")?._count ?? 0;
    const completedTasks = taskGroups.find((g) => g.status === "COMPLETED")?._count ?? 0;
    const onbTotal = onb.reduce((s, o) => s + o._count, 0);
    const onbDone = onb.find((o) => o.done)?._count ?? 0;

    return {
      id: store.id,
      name: store.name,
      address: store.address,
      status: store.status,
      members: members.map((m) => ({ id: m.id, name: m.displayName ?? m.email ?? "(no name)", email: m.email, role: m.role })),
      openTasks,
      completedTasks,
      onboardingPercent: safePercent(onbDone, onbTotal),
      announcementAcks: acks,
      artworkDownloads: downloads,
      score: storeScore([
        { percent: acks > 0 ? 100 : 0, available: true },
        { percent: safePercent(completedTasks, openTasks + completedTasks), available: openTasks + completedTasks > 0 },
        { percent: safePercent(onbDone, onbTotal), available: onbTotal > 0 },
      ]),
    };
  });
}
