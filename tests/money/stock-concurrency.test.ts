import { describe, it, expect, beforeEach } from "vitest";
import { installStripeMock } from "../helpers/mockStripe";

installStripeMock();

import { withTenant } from "@/server/db/withTenant";
import { checkout } from "@/server/modules/commerce/checkout";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

describe("Money suite: stock under concurrency", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("two concurrent checkouts cannot oversell tracked stock", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Limited", sku: "LTD-1" } })
    );
    // 4 in stock; two orders of 3 each — only one can possibly be filled.
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000, stock: 4 } })
    );

    const ctx = franchiseeCtx(tenant.id, location.id);
    const results = await Promise.allSettled([
      checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 3 }], idempotencyKey: `race-a-${Date.now()}` }),
      checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 3 }], idempotencyKey: `race-b-${Date.now()}` }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const after = await withTenant(kickCtx(), (tx) => tx.productVariant.findUniqueOrThrow({ where: { id: variant.id } }));
    expect(after.stock).toBe(1); // 4 - 3, never negative, never double-decremented

    const orders = await withTenant(kickCtx(), (tx) => tx.order.findMany({ where: { locationId: location.id } }));
    expect(orders).toHaveLength(1); // the losing transaction rolled back entirely
  });

  it("sequential re-check: second checkout fails once stock is exhausted", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Scarce", sku: "SCARCE-1" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000, stock: 2 } })
    );

    const ctx = franchiseeCtx(tenant.id, location.id);
    await checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 2 }], idempotencyKey: `seq-a-${Date.now()}` });

    await expect(
      checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 1 }], idempotencyKey: `seq-b-${Date.now()}` })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });
});
