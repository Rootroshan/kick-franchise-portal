import { withTenant, type RequestContext } from "@/server/db/withTenant";

/** Lightweight sidebar notification badge for the franchisor layout.
 *  Overdue task assignments + failed push deliveries. Tenant-scoped, no commerce. */
export async function getFranchisorBadgeCount(ctx: RequestContext, tenantId: string): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [overdue, pushFailures] = await Promise.all([
      tx.taskAssignment.count({ where: { task: { tenantId, dueAt: { lt: now } }, status: "OPEN" } }),
      tx.pushSubscription.count({ where: { tenantId, status: { in: ["FAILED", "DEAD"] } } }),
    ]);
    return overdue + pushFailures;
  });
}
