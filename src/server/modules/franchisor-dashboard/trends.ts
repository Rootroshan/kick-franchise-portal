import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { safePercent } from "./calculations";

export type TrendPoint = { label: string; announcements: number; tasks: number; onboarding: number; artwork: number };

/** Monthly engagement trend for the last `months` periods (default 6). No commerce. */
export async function getEngagementTrend(ctx: RequestContext, tenantId: string, months = 6, now = new Date()): Promise<TrendPoint[]> {
  return withTenant(ctx, async (tx) => {
    const activeStores = await tx.location.count({ where: { tenantId, status: "active" } });
    const denom = activeStores || 1;

    // Every month's 5 queries are independent of every other month's, so all
    // `months` batches fire concurrently instead of one month after another
    // (was `months` sequential round trips of 5 queries each).
    const ranges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx;
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      return { start, end, label: start.toLocaleDateString("en-US", { month: "short" }) };
    });

    const points: TrendPoint[] = await Promise.all(
      ranges.map(async ({ start, end, label }) => {
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

        return {
          label,
          announcements: safePercent(acks, reqAnns * denom),
          tasks: safePercent(taskDone, taskTotal),
          onboarding: safePercent(onbDone, onbTotal),
          artwork: Math.min(100, downloads), // raw count, capped for the shared 0-100 axis
        };
      })
    );
    return points;
  });
}
