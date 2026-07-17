import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { safePercent } from "./calculations";

export type TrendPoint = { label: string; announcements: number; tasks: number; onboarding: number; artwork: number };

/** Monthly engagement trend for the last `months` periods (default 6). No commerce. */
export async function getEngagementTrend(ctx: RequestContext, tenantId: string, months = 6, now = new Date()): Promise<TrendPoint[]> {
  return withTenant(ctx, async (tx) => {
    const activeStores = await tx.location.count({ where: { tenantId, status: "active" } });
    const denom = activeStores || 1;

    const points: TrendPoint[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString("en-US", { month: "short" });

      const [acks, reqAnns, taskAgg, onb, downloads] = await Promise.all([
        tx.announcementAck.count({ where: { acknowledgedAt: { gte: start, lt: end }, announcement: { tenantId, requiresAck: true } } }),
        tx.announcement.count({ where: { tenantId, requiresAck: true, publishAt: { gte: start, lt: end } } }),
        tx.taskAssignment.groupBy({ by: ["status"], where: { task: { tenantId }, createdAt: { gte: start, lt: end } }, _count: true }),
        tx.onboardingProgress.groupBy({ by: ["done"], where: { item: { template: { tenantId } }, doneAt: { gte: start, lt: end } }, _count: true }),
        tx.auditLog.count({ where: { tenantId, action: "asset.download", createdAt: { gte: start, lt: end } } }),
      ]);

      const taskTotal = taskAgg.reduce((s, g) => s + g._count, 0);
      const taskDone = taskAgg.find((g) => g.status === "COMPLETED")?._count ?? 0;
      const onbTotal = onb.reduce((s, o) => s + o._count, 0);
      const onbDone = onb.find((o) => o.done)?._count ?? 0;

      points.push({
        label,
        announcements: safePercent(acks, reqAnns * denom),
        tasks: safePercent(taskDone, taskTotal),
        onboarding: safePercent(onbDone, onbTotal),
        artwork: Math.min(100, downloads), // raw count, capped for the shared 0-100 axis
      });
    }
    return points;
  });
}
