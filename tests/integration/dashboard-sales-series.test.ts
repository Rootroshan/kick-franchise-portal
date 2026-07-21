import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { getDashboardData } from "@/server/modules/dashboard/service";

/**
 * The 6-month sales series was rewritten from 6 sequential per-month
 * aggregates to one bounded query bucketed in memory — this pins that the
 * bucketing is still correct, including an order landing exactly on a month
 * boundary (a classic off-by-one risk when switching from DB-side date
 * range filters to in-memory range checks).
 */
describe("Dashboard sales series", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("buckets orders into the correct month, including one at the boundary", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    await withTenant(kickCtx(), async (tx) => {
      // Lands in the current month.
      await tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 1000,
          idempotencyKey: "series-this-month",
          placedBy: "u",
          createdAt: new Date(thisMonthStart.getTime() + 60_000),
        },
      });
      // Exactly at the boundary — must count toward the PREVIOUS month
      // (range is [start, end)), not the current one.
      await tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 500,
          idempotencyKey: "series-boundary",
          placedBy: "u",
          createdAt: lastMonthStart,
        },
      });
      // A non-paid order in the current month must be excluded entirely.
      await tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PENDING",
          subtotalCents: 99999,
          idempotencyKey: "series-pending-excluded",
          placedBy: "u",
          createdAt: new Date(thisMonthStart.getTime() + 60_000),
        },
      });
    });

    const dash = await getDashboardData(kickCtx());
    expect(dash.sales.series).toHaveLength(6);

    const totalBucketed = dash.sales.series.reduce((s, p) => s + p.cents, 0);
    // Only the two PAID orders should be counted anywhere in the series.
    expect(totalBucketed).toBe(1500);

    const lastPoint = dash.sales.series[5]!; // current month, last in the series
    expect(lastPoint.cents).toBe(1000);
    const secondLastPoint = dash.sales.series[4]!; // previous month
    expect(secondLastPoint.cents).toBe(500);
  });
});
