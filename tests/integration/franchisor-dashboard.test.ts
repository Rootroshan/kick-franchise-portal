import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { getFranchisorDashboard } from "@/server/modules/franchisor-dashboard/service";
import { franchisorSearch } from "@/server/modules/franchisor-dashboard/search";
import { FRANCHISOR_NAV } from "@/components/franchisor/layout/franchisorNav";

/**
 * Integration coverage for the franchisor dashboard: tenant isolation,
 * permitted-only data, and no-commerce guarantees at the service layer.
 */
describe("Franchisor dashboard service", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns only the caller's tenant data (no cross-tenant leakage)", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();

    // Announcement in tenant B only.
    await withTenant(kickCtx(), (tx) =>
      tx.announcement.create({ data: { tenantId: b.tenant.id, title: "B-only", body: "x", status: "PUBLISHED", createdBy: "seed" } })
    );

    const dashA = await getFranchisorDashboard(franchisorCtx(a.tenant.id), {});
    expect(dashA.brand.id).toBe(a.tenant.id);
    expect(dashA.announcements.find((x) => x.title === "B-only")).toBeUndefined();
  });

  it("rejects a non-franchisor role", async () => {
    const { tenant } = await seedTenantWithLocation();
    await expect(getFranchisorDashboard(kickCtx(), {})).rejects.toThrow();
    // kickCtx has tenantId null anyway; assert the role gate specifically:
    await expect(getFranchisorDashboard({ ...kickCtx(), tenantId: tenant.id }, {})).rejects.toThrow(/franchisor admins/i);
  });

  it("computes announcement-read percentage from acks", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ann = await withTenant(kickCtx(), (tx) =>
      tx.announcement.create({ data: { tenantId: tenant.id, title: "Ack me", body: "x", status: "PUBLISHED", requiresAck: true, publishAt: new Date(), createdBy: "seed" } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.announcementAck.create({ data: { announcementId: ann.id, clerkUserId: "u1", locationId: location.id, acknowledgedAt: new Date() } })
    );

    const dash = await getFranchisorDashboard(franchisorCtx(tenant.id), {});
    const kpi = dash.kpis.find((k) => k.key === "announcementsRead");
    expect(kpi?.available).toBe(true);
    // 1 ack / (1 required ann × 1 active store) = 100%
    expect(kpi?.raw).toBe(100);
  });

  it("search returns permitted entities and never commerce", async () => {
    const { tenant } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) =>
      tx.announcement.create({ data: { tenantId: tenant.id, title: "Summer Menu", body: "x", status: "PUBLISHED", createdBy: "seed" } })
    );
    // A product exists but must never appear in results.
    await withTenant(kickCtx(), (tx) => tx.product.create({ data: { tenantId: tenant.id, name: "Summer Cup", sku: "SUM-1" } }));

    const res = await franchisorSearch(franchisorCtx(tenant.id), tenant.id, "Summer");
    expect(res.announcements.some((a) => a.title === "Summer Menu")).toBe(true);
    // results shape has no product/order/allowance/rebate keys at all
    expect(Object.keys(res).sort()).toEqual(["announcements", "artwork", "onboarding", "stores", "tasks", "users"]);
  });

  it("sidebar nav contains no commerce links", () => {
    const banned = ["catalogue", "product", "order", "payment", "allowance", "rebate", "commerce", "pricing", "inventory", "sku", "fulfil"];
    for (const item of FRANCHISOR_NAV) {
      const href = item.href.toLowerCase();
      const label = item.label.toLowerCase();
      for (const word of banned) {
        expect(href.includes(word), `nav href ${item.href} must not contain "${word}"`).toBe(false);
        expect(label.includes(word), `nav label ${item.label} must not contain "${word}"`).toBe(false);
      }
    }
  });
});
