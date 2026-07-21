import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listRebateRulesAdmin, getRebateKpis } from "@/server/modules/rebates/admin";
import { listReportsAdmin, getReportKpis } from "@/server/modules/rebates/reportsAdmin";
import type { AdminListQuery } from "@/lib/adminQuery";

const listQuery: AdminListQuery = { page: 1, limit: 20, search: "", status: "", brand: "", sort: "", direction: "asc", raw: {} };

/**
 * Rebates (rules, accruals, reports) are commerce/financial data — the
 * category FRANCHISOR_ADMIN must never reach. These exercise the service
 * directly with a franchisor context, so they prove the DATABASE denies it
 * (RLS) rather than merely that a route guard is present.
 */
describe("Rebates are locked out from franchisors", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a franchisor sees zero rebate rules even with rules present", async () => {
    const { tenant } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: `sku-${Date.now()}` } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: { tenantId: tenant.id, productId: product.id, type: "FLAT", value: 500, effectiveFrom: new Date(), createdBy: "seed-user" },
      })
    );

    const asKick = await listRebateRulesAdmin(kickCtx(), listQuery);
    expect(asKick.total).toBe(1);

    const asFranchisor = await listRebateRulesAdmin(franchisorCtx(tenant.id), listQuery);
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("rebate KPIs read zero for a franchisor", async () => {
    const { tenant } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: `sku-${Date.now()}` } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: { tenantId: tenant.id, productId: product.id, type: "FLAT", value: 500, effectiveFrom: new Date(), createdBy: "seed-user" },
      })
    );

    expect((await getRebateKpis(kickCtx())).rules).toBe(1);
    expect((await getRebateKpis(franchisorCtx(tenant.id))).rules).toBe(0);
  });

  it("a franchisor sees zero rebate reports even with reports present", async () => {
    const { tenant } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.rebateReport.create({
        data: {
          tenantId: tenant.id,
          period: "MONTHLY",
          periodLabel: "2026-07",
          salesTotalCents: 10_000,
          rebateTotalCents: 500,
          breakdownJson: {},
        },
      })
    );

    const asKick = await listReportsAdmin(kickCtx(), listQuery);
    expect(asKick.total).toBe(1);

    const asFranchisor = await listReportsAdmin(franchisorCtx(tenant.id), listQuery);
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("rebate report KPIs read zero for a franchisor", async () => {
    const { tenant } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.rebateReport.create({
        data: {
          tenantId: tenant.id,
          period: "MONTHLY",
          periodLabel: "2026-07",
          salesTotalCents: 10_000,
          rebateTotalCents: 500,
          breakdownJson: {},
        },
      })
    );

    expect((await getReportKpis(kickCtx())).total).toBe(1);
    expect((await getReportKpis(franchisorCtx(tenant.id))).total).toBe(0);
  });
});
