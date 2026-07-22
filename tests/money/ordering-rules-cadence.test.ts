import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { assertOrderingRulesSatisfied } from "@/server/modules/commerce/orderingRules";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

/**
 * Regression for the cadence check's status filter: it must reuse
 * STATUS_BUCKETS (src/lib/orderStatus.ts) rather than a hand-rolled status
 * list, or orders that progress past PENDING/PAID into active fulfilment
 * (PROCESSING/SHIPPED/DELIVERED) silently stop counting toward the cadence
 * lock.
 */
describe("Money suite: ordering rules cadence", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("blocks a reorder when the prior order is PROCESSING, not just PENDING/PAID", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Cadenced Widget", sku: `CAD-${Date.now()}` } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000 } })
    );

    await withTenant(kickCtx(), (tx) =>
      tx.locationOrderingRule.create({
        data: { locationId: location.id, productId: product.id, cadenceDays: 30 },
      })
    );

    // Prior order placed yesterday, already progressed past PENDING/PAID.
    const priorOrder = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PROCESSING",
          subtotalCents: 1000,
          idempotencyKey: `prior-${Date.now()}`,
          placedBy: "test-franchisee",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.orderLine.create({
        data: { orderId: priorOrder.id, variantId: variant.id, qty: 1, unitPriceCents: 1000 },
      })
    );

    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 1 }])
      )
    ).rejects.toMatchObject({ code: "ORDERING_RULE_CADENCE" });
  });

  it("rejects a quantity below the configured minimum", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Min Qty Widget", sku: `MIN-${Date.now()}` } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 500 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.locationOrderingRule.create({ data: { locationId: location.id, productId: product.id, minQty: 5 } })
    );

    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 2 }])
      )
    ).rejects.toMatchObject({ code: "ORDERING_RULE_MIN" });

    // At or above the minimum, the same rule passes.
    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 5 }])
      )
    ).resolves.toBeUndefined();
  });

  it("rejects a quantity above the configured maximum", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Max Qty Widget", sku: `MAX-${Date.now()}` } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 500 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.locationOrderingRule.create({ data: { locationId: location.id, productId: product.id, maxQty: 10 } })
    );

    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 11 }])
      )
    ).rejects.toMatchObject({ code: "ORDERING_RULE_MAX" });

    // At or below the maximum, the same rule passes.
    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 10 }])
      )
    ).resolves.toBeUndefined();
  });

  it("a global rule (productId: null) applies to every product at the location", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Any Widget", sku: `GLOBAL-${Date.now()}` } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 500 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.locationOrderingRule.create({ data: { locationId: location.id, productId: null, maxQty: 3 } })
    );

    await expect(
      withTenant(kickCtx(), (tx) =>
        assertOrderingRulesSatisfied(tx, location.id, [{ variantId: variant.id, productId: product.id, qty: 4 }])
      )
    ).rejects.toMatchObject({ code: "ORDERING_RULE_MAX" });
  });
});
