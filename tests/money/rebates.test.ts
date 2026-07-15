import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { computeRebateAmountCents, accrueRebatesForOrder } from "@/server/modules/rebates/accrual";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

describe("Money suite: rebate calculations", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("flat rebate: value (cents) * qty", () => {
    expect(computeRebateAmountCents("FLAT", 150, 1000 /* unused for flat */, 3)).toBe(450);
  });

  it("percent rebate: basis points applied to unitPriceCents * qty with correct integer rounding", () => {
    // 5% (500 bps) of $10.00 (1000 cents) * 3 units = 3000 * 500 / 10000 = 150
    expect(computeRebateAmountCents("PERCENT", 500, 1000, 3)).toBe(150);
    // Rounding case: 333 bps of 999 cents * 1 = 33.2667 -> rounds to 33
    expect(computeRebateAmountCents("PERCENT", 333, 999, 1)).toBe(33);
    // 100% (10000 bps)
    expect(computeRebateAmountCents("PERCENT", 10_000, 1234, 1)).toBe(1234);
  });

  it("accrues a flat rebate exactly once when an order is paid, respecting effective date range", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "REB-1" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 2000 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: { tenantId: tenant.id, productId: product.id, type: "FLAT", value: 200, effectiveFrom: new Date(Date.now() - 86_400_000), createdBy: "seed" },
      })
    );

    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 4000,
          idempotencyKey: `reb-${Date.now()}`,
          placedBy: "seed",
          lines: { create: [{ variantId: variant.id, qty: 2, unitPriceCents: 2000 }] },
        },
      })
    );

    const accrued = await withTenant(kickCtx(), (tx) => accrueRebatesForOrder(tx, order.id));
    expect(accrued).toHaveLength(1);
    const first = accrued[0]!;
    expect(first.amountCents).toBe(400); // 200 cents * 2 qty

    const rows = await withTenant(kickCtx(), (tx) => tx.rebateAccrual.findMany({ where: { orderLineId: first.orderLineId } }));
    expect(rows).toHaveLength(1);
  });

  it("does not double-accrue when called twice for the same order (duplicate webhook safety)", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "REB-2" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: { tenantId: tenant.id, productId: product.id, type: "PERCENT", value: 1000, effectiveFrom: new Date(Date.now() - 86_400_000), createdBy: "seed" },
      })
    );

    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 1000,
          idempotencyKey: `reb-dup-${Date.now()}`,
          placedBy: "seed",
          lines: { create: [{ variantId: variant.id, qty: 1, unitPriceCents: 1000 }] },
        },
      })
    );

    await withTenant(kickCtx(), (tx) => accrueRebatesForOrder(tx, order.id));
    await withTenant(kickCtx(), (tx) => accrueRebatesForOrder(tx, order.id)); // simulate duplicate webhook

    const allAccruals = await withTenant(kickCtx(), (tx) => tx.rebateAccrual.findMany({ where: { tenantId: tenant.id } }));
    expect(allAccruals).toHaveLength(1); // still only one, not two
  });

  it("does not accrue a rebate outside its effective date range", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const product = await withTenant(kickCtx(), (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, name: "Widget", sku: "REB-3" } })
    );
    const variant = await withTenant(kickCtx(), (tx) =>
      tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents: 1000 } })
    );
    // Rebate rule expired yesterday.
    await withTenant(kickCtx(), (tx) =>
      tx.rebateRule.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          type: "FLAT",
          value: 100,
          effectiveFrom: new Date(Date.now() - 30 * 86_400_000),
          effectiveTo: new Date(Date.now() - 86_400_000),
          createdBy: "seed",
        },
      })
    );

    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 1000,
          idempotencyKey: `reb-expired-${Date.now()}`,
          placedBy: "seed",
          lines: { create: [{ variantId: variant.id, qty: 1, unitPriceCents: 1000 }] },
        },
      })
    );

    const accrued = await withTenant(kickCtx(), (tx) => accrueRebatesForOrder(tx, order.id));
    expect(accrued).toHaveLength(0);
  });

  it("cancellation/refund creates a compensating positive ledger entry without editing the original debit row", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const allowance = await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({
        data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-TEST", grantedCents: 10_000, createdBy: "seed" },
      })
    );
    const order = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 3000,
          allowanceAppliedCents: 3000,
          idempotencyKey: `refund-${Date.now()}`,
          placedBy: "seed",
        },
      })
    );
    const debit = await withTenant(kickCtx(), (tx) =>
      tx.allowanceLedger.create({
        data: { allowanceId: allowance.id, orderId: order.id, deltaCents: -3000, balanceAfter: 7000, reason: "ORDER_DEBIT" },
      })
    );

    const { refundOrder } = await import("@/server/modules/commerce/orderLifecycle");
    await refundOrder(order.id, 3000);

    const ledgerRows = await withTenant(kickCtx(), (tx) => tx.allowanceLedger.findMany({ where: { allowanceId: allowance.id }, orderBy: { createdAt: "asc" } }));
    expect(ledgerRows).toHaveLength(2);
    // Original debit row is untouched.
    const originalDebit = ledgerRows.find((r) => r.id === debit.id)!;
    expect(originalDebit.deltaCents).toBe(-3000);
    // New compensating credit row.
    const credit = ledgerRows.find((r) => r.id !== debit.id)!;
    expect(credit.deltaCents).toBe(3000);
    expect(credit.reason).toBe("REFUND_CREDIT");
  });
});
