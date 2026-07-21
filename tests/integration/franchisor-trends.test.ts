import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { getEngagementTrend } from "@/server/modules/franchisor-dashboard/trends";

/**
 * getEngagementTrend's per-month batches were switched from sequential to
 * concurrent (all `months` Promise.all groups fire at once instead of one
 * month after another) — this pins that months still come back in
 * chronological order with the right data in the right bucket, since
 * parallelizing independent async work is exactly the kind of change that
 * can silently reorder results if done carelessly.
 */
describe("Franchisor engagement trend", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns months in chronological order, oldest first", async () => {
    const { tenant } = await seedTenantWithLocation();
    const now = new Date(2026, 5, 15); // June 2026, fixed so labels are deterministic

    const points = await getEngagementTrend(franchisorCtx(tenant.id), tenant.id, 6, now);

    expect(points).toHaveLength(6);
    expect(points.map((p) => p.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
  });

  it("attributes an announcement ack to the month it happened in, not an adjacent one", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const now = new Date(2026, 5, 15);
    const marchAck = new Date(2026, 2, 10);

    await withTenant(kickCtx(), async (tx) => {
      const ann = await tx.announcement.create({
        data: { tenantId: tenant.id, title: "Ack me", body: "x", status: "PUBLISHED", requiresAck: true, publishAt: marchAck, createdBy: "seed" },
      });
      await tx.announcementAck.create({
        data: { announcementId: ann.id, clerkUserId: "u1", locationId: location.id, acknowledgedAt: marchAck },
      });
    });

    const points = await getEngagementTrend(franchisorCtx(tenant.id), tenant.id, 6, now);
    const march = points.find((p) => p.label === "Mar")!;
    const otherMonths = points.filter((p) => p.label !== "Mar");

    expect(march.announcements).toBeGreaterThan(0);
    expect(otherMonths.every((p) => p.announcements === 0)).toBe(true);
  });
});
