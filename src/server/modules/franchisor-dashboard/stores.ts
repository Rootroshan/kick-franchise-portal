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
