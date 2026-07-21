import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listAllowancesAdmin, getAllowanceKpis, getAllowanceDetail } from "@/server/modules/allowances/listView";
import type { AdminListQuery } from "@/lib/adminQuery";

const listQuery: AdminListQuery = { page: 1, limit: 20, search: "", status: "", brand: "", sort: "", direction: "asc", raw: {} };

/**
 * Allowances are commerce/financial data — the category FRANCHISOR_ADMIN
 * must never reach. These exercise the service directly with a franchisor
 * context, so they prove the DATABASE denies it (RLS) rather than merely
 * that a route guard is present.
 */
describe("Allowances are locked out from franchisors", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a franchisor sees zero allowances even with allowances present", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({
        data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 50_000, createdBy: "seed-user" },
      })
    );

    const asKick = await listAllowancesAdmin(kickCtx(), listQuery);
    expect(asKick.total).toBe(1);

    const asFranchisor = await listAllowancesAdmin(franchisorCtx(tenant.id), listQuery);
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("allowance KPIs read zero for a franchisor", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({
        data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 50_000, createdBy: "seed-user" },
      })
    );

    expect((await getAllowanceKpis(kickCtx())).grantedCents).toBe(50_000);
    expect((await getAllowanceKpis(franchisorCtx(tenant.id))).grantedCents).toBe(0);
  });

  it("a franchisor cannot fetch a single allowance by id — even their own tenant's", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    const allowance = await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({
        data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 50_000, createdBy: "seed-user" },
      })
    );

    await expect(getAllowanceDetail(kickCtx(), allowance.id)).resolves.toBeTruthy();
    await expect(getAllowanceDetail(franchisorCtx(tenant.id), allowance.id)).rejects.toThrow();
  });
});
