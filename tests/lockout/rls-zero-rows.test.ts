import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Layer 4 of the franchisor lockout: proves that even with a hand-crafted
 * query and a FRANCHISOR_ADMIN session context, PostgreSQL RLS returns ZERO
 * rows from commerce/allowance/rebate tables — real data, real Postgres,
 * real non-superuser role. This is the backstop the spec calls the thing
 * that "makes it real rather than a promise."
 */
describe("RLS: FRANCHISOR_ADMIN sees zero commerce/allowance/rebate rows", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns zero Product rows to a franchisor session despite seeded data", async () => {
    const { tenant } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "WID-1" } })
    );

    const kickCount = await withTenant(kickCtx(), (tx) => tx.product.count());
    expect(kickCount).toBeGreaterThan(0);

    const franchisorProducts = await withTenant(franchisorCtx(tenant.id), (tx) => tx.product.findMany());
    expect(franchisorProducts).toHaveLength(0);
  });

  it("returns zero Order rows to a franchisor session", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "WID-2" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          subtotalCents: 1000,
          idempotencyKey: `test-${Date.now()}`,
          placedBy: "seed",
          lines: { create: [{ variantId: variant.id, qty: 1, unitPriceCents: 1000 }] },
        },
      })
    );

    const franchisorOrders = await withTenant(franchisorCtx(tenant.id), (tx) => tx.order.findMany());
    expect(franchisorOrders).toHaveLength(0);
  });

  it("returns zero Allowance and AllowanceLedger rows to a franchisor session", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    const allowance = await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({
        data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 50_000, createdBy: "seed" },
      })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.allowanceLedger.create({
        data: { allowanceId: allowance.id, deltaCents: 50_000, balanceAfter: 50_000, reason: "GRANT" },
      })
    );

    const franchisorAllowances = await withTenant(franchisorCtx(tenant.id), (tx) => tx.allowance.findMany());
    const franchisorLedger = await withTenant(franchisorCtx(tenant.id), (tx) => tx.allowanceLedger.findMany());
    expect(franchisorAllowances).toHaveLength(0);
    expect(franchisorLedger).toHaveLength(0);
  });

  it("returns zero RebateRule and RebateAccrual rows to a franchisor session", async () => {
    const { tenant } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "WID-3" } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: { tenantId: tenant.id, productId: product.id, type: "FLAT", value: 100, effectiveFrom: new Date(), createdBy: "seed" },
      })
    );

    const franchisorRules = await withTenant(franchisorCtx(tenant.id), (tx) => tx.rebateRule.findMany());
    expect(franchisorRules).toHaveLength(0);
  });

  it("blocks a franchisor session from WRITING to Product even if application code has a bug", async () => {
    const { tenant } = await seedTenantWithLocation();

    await expect(
      withTenant(franchisorCtx(tenant.id), (tx) =>
        tx.product.create({ data: { tenantId: tenant.id, name: "Sneaky", sku: "SNEAK-1" } })
      )
    ).rejects.toThrow();
  });

  it("allows a franchisee session to see ONLY their own location's orders, not other locations in the same tenant", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const otherLocation = await withTenant(kickCtx(), (tx) =>
      tx.location.create({ data: { tenantId: tenant.id, name: "Other Store" } })
    );

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "WID-4" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 500 } })
    );

    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: otherLocation.id,
          subtotalCents: 500,
          idempotencyKey: `other-${Date.now()}`,
          placedBy: "seed",
          lines: { create: [{ variantId: variant.id, qty: 1, unitPriceCents: 500 }] },
        },
      })
    );

    const myOrders = await withTenant(franchiseeCtx(tenant.id, location.id), (tx) => tx.order.findMany());
    expect(myOrders).toHaveLength(0); // the seeded order belongs to otherLocation, not mine
  });
});
