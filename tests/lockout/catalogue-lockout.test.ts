import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listProductsAdmin, getCatalogueKpis } from "@/server/modules/commerce/admin";
import type { AdminListQuery } from "@/lib/adminQuery";

const listQuery: AdminListQuery = { page: 1, limit: 20, search: "", status: "", brand: "", sort: "", direction: "asc", raw: {} };

/**
 * Catalogue (Product/ProductVariant) is commerce data — the category
 * FRANCHISOR_ADMIN must never reach. These exercise the service directly
 * with a franchisor context, so they prove the DATABASE denies it (RLS)
 * rather than merely that a route guard is present.
 */
describe("Catalogue is locked out from franchisors", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a franchisor sees zero products even with products present", async () => {
    const { tenant } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: `sku-${Date.now()}` } })
    );
    await withTenant(kickCtx(), (tx) => tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1_500 } }));

    const asKick = await listProductsAdmin(kickCtx(), listQuery);
    expect(asKick.total).toBe(1);

    const asFranchisor = await listProductsAdmin(franchisorCtx(tenant.id), listQuery);
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("catalogue KPIs read zero for a franchisor", async () => {
    const { tenant } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: `sku-${Date.now()}` } })
    );
    await withTenant(kickCtx(), (tx) => tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1_500 } }));

    expect((await getCatalogueKpis(kickCtx())).products).toBe(1);
    expect((await getCatalogueKpis(franchisorCtx(tenant.id))).products).toBe(0);
  });

  // No franchisor-facing service function reads LocationOrderingRule today —
  // it is only read internally at checkout (assertOrderingRulesSatisfied),
  // not exposed as an admin list. This checks RLS directly at the table
  // level, which is the only enforcement layer this data currently has.
  it("a franchisor cannot read ordering rules directly, even via RLS alone", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await withTenant(kickCtx(), (tx) => tx.locationOrderingRule.create({ data: { locationId: location.id, minQty: 1, maxQty: 10 } }));

    const asKick = await withTenant(kickCtx(), (tx) => tx.locationOrderingRule.findMany({ where: { locationId: location.id } }));
    expect(asKick).toHaveLength(1);

    const asFranchisor = await withTenant(franchisorCtx(tenant.id), (tx) => tx.locationOrderingRule.findMany({ where: { locationId: location.id } }));
    expect(asFranchisor).toHaveLength(0);
  });
});
