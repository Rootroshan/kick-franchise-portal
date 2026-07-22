import { describe, it, expect, beforeEach } from "vitest";
import { installStripeMock } from "../helpers/mockStripe";

installStripeMock();

import { withTenant } from "@/server/db/withTenant";
import { checkout } from "@/server/modules/commerce/checkout";
import { computeAllowanceBalance } from "@/server/modules/allowances/ledger";
import { kickCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

async function seedProductAndVariant(tenantId: string, priceCents: number) {
  const product = await withTenant(kickCtx(), (tx) =>
    tx.product.create({ data: { tenantId, name: "Widget", sku: `WID-${Date.now()}-${Math.random()}` } })
  );
  const variant = await withTenant(kickCtx(), (tx) =>
    tx.productVariant.create({ data: { productId: product.id, name: "Default", priceCents } })
  );
  return { product, variant };
}

async function grantAllowance(tenantId: string, locationId: string, grantedCents: number, overflow: "BLOCK" | "CHARGE_CARD" = "CHARGE_CARD") {
  return withTenant(kickCtx(), (tx) =>
    tx.allowance.create({
      data: { tenantId, locationId, periodLabel: currentPeriodLabel(), grantedCents, overflow, createdBy: "seed" },
    })
  );
}

function currentPeriodLabel(): string {
  const now = new Date();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${quarter}`;
}

describe("Money suite: allowance + checkout", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("allowance-only checkout: order fully covered by balance, zero card charge", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 5000); // $50.00
    await grantAllowance(tenant.id, location.id, 10_000); // $100.00

    const ctx = franchiseeCtx(tenant.id, location.id);
    const result = await checkout(ctx, tenant.id, {
      items: [{ variantId: variant.id, qty: 1 }],
      idempotencyKey: `key-${Date.now()}-1`,
    });

    expect(result.subtotalCents).toBe(5000);
    expect(result.allowanceAppliedCents).toBe(5000);
    expect(result.cardChargedCents).toBe(0);
    expect(result.status).toBe("PAID");
    expect(result.clientSecret).toBeNull();
  });

  it("zero balance: entire order goes to card", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 3000);
    await grantAllowance(tenant.id, location.id, 0);

    const ctx = franchiseeCtx(tenant.id, location.id);
    const result = await checkout(ctx, tenant.id, {
      items: [{ variantId: variant.id, qty: 1 }],
      idempotencyKey: `key-${Date.now()}-2`,
    });

    expect(result.allowanceAppliedCents).toBe(0);
    expect(result.status).toBe("PENDING"); // awaiting Stripe webhook confirmation
  });

  it("exact balance: order cost equals balance exactly, zero remainder", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 2500);
    await grantAllowance(tenant.id, location.id, 2500);

    const ctx = franchiseeCtx(tenant.id, location.id);
    const result = await checkout(ctx, tenant.id, {
      items: [{ variantId: variant.id, qty: 1 }],
      idempotencyKey: `key-${Date.now()}-3`,
    });

    expect(result.allowanceAppliedCents).toBe(2500);
    expect(result.status).toBe("PAID");
  });

  it("split allowance and card: insufficient allowance overflows to card charge for the remainder", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 12_000); // $120.00
    await grantAllowance(tenant.id, location.id, 10_000); // $100.00 balance

    const ctx = franchiseeCtx(tenant.id, location.id);
    const result = await checkout(ctx, tenant.id, {
      items: [{ variantId: variant.id, qty: 1 }],
      idempotencyKey: `key-${Date.now()}-4`,
    });

    // Spec example: remaining allowance 10000, subtotal 12000 -> 10000 applied, 2000 to card
    expect(result.subtotalCents).toBe(12_000);
    expect(result.allowanceAppliedCents).toBe(10_000);
    expect(result.status).toBe("PENDING");
    expect(result.clientSecret).not.toBeNull();

    const balanceAfter = await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      return computeAllowanceBalance(tx, allowance.id);
    });
    expect(balanceAfter).toBe(0);
  });

  it("BLOCK overflow behavior: insufficient allowance with BLOCK rejects checkout with 409", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 12_000);
    await grantAllowance(tenant.id, location.id, 10_000, "BLOCK");

    const ctx = franchiseeCtx(tenant.id, location.id);
    await expect(
      checkout(ctx, tenant.id, {
        items: [{ variantId: variant.id, qty: 1 }],
        idempotencyKey: `key-${Date.now()}-5`,
      })
    ).rejects.toMatchObject({ status: 409 });

    // Balance must be untouched — no ledger entry written on a blocked checkout.
    const balance = await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      return computeAllowanceBalance(tx, allowance.id);
    });
    expect(balance).toBe(10_000);
  });

  it("duplicate checkout submission with the same idempotency key returns the original order, does not double-debit", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 4000);
    await grantAllowance(tenant.id, location.id, 10_000);

    const ctx = franchiseeCtx(tenant.id, location.id);
    const idempotencyKey = `key-dup-${Date.now()}`;

    const first = await checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 1 }], idempotencyKey });
    const second = await checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 1 }], idempotencyKey });

    expect(second.orderId).toBe(first.orderId);

    const balance = await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      return computeAllowanceBalance(tx, allowance.id);
    });
    // Only debited once (4000), not twice (8000).
    expect(balance).toBe(6000);
  });

  it("rejects a variant id that doesn't exist at all", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const ctx = franchiseeCtx(tenant.id, location.id);

    await expect(
      checkout(ctx, tenant.id, {
        items: [{ variantId: "00000000-0000-0000-0000-000000000000", qty: 1 }],
        idempotencyKey: `key-badvariant-${Date.now()}`,
      })
    ).rejects.toMatchObject({ status: 422, code: "VARIANT_UNAVAILABLE" });
  });

  it("rejects a variant that belongs to a different tenant (cross-tenant variant id cannot be checked out)", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { tenant: otherTenant } = await seedTenantWithLocation();
    const { variant: otherTenantVariant } = await seedProductAndVariant(otherTenant.id, 5000);

    const ctx = franchiseeCtx(tenant.id, location.id);
    await expect(
      checkout(ctx, tenant.id, {
        items: [{ variantId: otherTenantVariant.id, qty: 1 }],
        idempotencyKey: `key-crosstenant-${Date.now()}`,
      })
    ).rejects.toMatchObject({ status: 422, code: "VARIANT_UNAVAILABLE" });
  });

  it("rejects a deactivated (inactive) product's variant", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { product, variant } = await seedProductAndVariant(tenant.id, 5000);
    await withTenant(kickCtx(), (tx) => tx.product.update({ where: { id: product.id }, data: { active: false } }));

    const ctx = franchiseeCtx(tenant.id, location.id);
    await expect(
      checkout(ctx, tenant.id, {
        items: [{ variantId: variant.id, qty: 1 }],
        idempotencyKey: `key-inactive-${Date.now()}`,
      })
    ).rejects.toMatchObject({ status: 422, code: "VARIANT_UNAVAILABLE" });
  });

  it("ignores a client-supplied price/total — the server always re-prices from the live ProductVariant row", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 7500); // real server price: $75.00
    await grantAllowance(tenant.id, location.id, 20_000);

    const ctx = franchiseeCtx(tenant.id, location.id);
    // The checkout request schema has no price/total field at all — a caller
    // cannot send one even by constructing the payload directly, which is
    // itself the enforcement. Cast through `unknown` to simulate a client
    // attempting to smuggle a manipulated price/total past validation.
    const manipulated = {
      items: [{ variantId: variant.id, qty: 1, priceCents: 1, unitPriceCents: 1 }],
      idempotencyKey: `key-manipulated-${Date.now()}`,
      totalCents: 1,
    } as unknown as Parameters<typeof checkout>[2];

    const result = await checkout(ctx, tenant.id, manipulated);

    // The real server-side price (7500) was charged, not the smuggled 1 cent.
    expect(result.subtotalCents).toBe(7500);
  });

  it("retry after a crash between DB-commit and PaymentIntent creation resumes payment instead of erroring or re-debiting", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 12_000); // $120
    await grantAllowance(tenant.id, location.id, 10_000); // $100 balance -> $20 card remainder

    const ctx = franchiseeCtx(tenant.id, location.id);
    const idempotencyKey = `key-crash-${Date.now()}`;

    // Simulate phase 1 (the DB transaction) having already committed in a
    // prior process that then crashed before phase 2 (creating the Stripe
    // PaymentIntent) ever ran — a PENDING order that debited the allowance
    // but has no stripePaymentIntentId yet.
    const preExisting = await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PENDING",
          paidAt: null,
          subtotalCents: 12_000,
          allowanceAppliedCents: 10_000,
          cardChargedCents: 0,
          currency: "CAD",
          stripePaymentIntentId: null,
          idempotencyKey,
          placedBy: "seed",
        },
      })
    );
    await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      await tx.allowanceLedger.create({
        data: { allowanceId: allowance.id, orderId: preExisting.id, deltaCents: -10_000, balanceAfter: 0, reason: "ORDER_DEBIT" },
      });
    });

    // Retry with the same idempotencyKey — must resume phase 2 for the
    // EXISTING order (same orderId, a real clientSecret), not throw, not
    // create a second order, and not double-debit the allowance.
    const retried = await checkout(ctx, tenant.id, {
      items: [{ variantId: variant.id, qty: 1 }],
      idempotencyKey,
    });

    expect(retried.orderId).toBe(preExisting.id);
    expect(retried.clientSecret).not.toBeNull();

    const orderAfter = await withTenant(kickCtx(), (tx) => tx.order.findUniqueOrThrow({ where: { id: preExisting.id } }));
    expect(orderAfter.stripePaymentIntentId).not.toBeNull();

    const balance = await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      return computeAllowanceBalance(tx, allowance.id);
    });
    // Still only debited once (10000), not twice.
    expect(balance).toBe(0);

    const orderCount = await withTenant(kickCtx(), (tx) => tx.order.count({ where: { locationId: location.id } }));
    expect(orderCount).toBe(1);
  });

  it("two simultaneous checkouts against one allowance never overspend (concurrency safety)", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const { variant } = await seedProductAndVariant(tenant.id, 6000); // $60 each
    await grantAllowance(tenant.id, location.id, 10_000); // only enough for ONE order fully

    const ctx = franchiseeCtx(tenant.id, location.id);

    // Fire two checkouts at the same instant for the same location/allowance.
    const [r1, r2] = await Promise.all([
      checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 1 }], idempotencyKey: `race-${Date.now()}-a` }),
      checkout(ctx, tenant.id, { items: [{ variantId: variant.id, qty: 1 }], idempotencyKey: `race-${Date.now()}-b` }),
    ]);

    // Total allowance applied across both orders must never exceed the granted balance.
    const totalApplied = r1.allowanceAppliedCents + r2.allowanceAppliedCents;
    expect(totalApplied).toBeLessThanOrEqual(10_000);

    // Combined, the two orders' remainder + applied must equal 12000 total subtotal.
    const totalCardRemainder = (r1.status === "PENDING" ? 6000 - r1.allowanceAppliedCents : 0) + (r2.status === "PENDING" ? 6000 - r2.allowanceAppliedCents : 0);
    expect(totalApplied + totalCardRemainder).toBe(12_000);

    const finalBalance = await withTenant(kickCtx(), async (tx) => {
      const allowance = await tx.allowance.findFirstOrThrow({ where: { locationId: location.id } });
      return computeAllowanceBalance(tx, allowance.id);
    });
    expect(finalBalance).toBe(10_000 - totalApplied);
    expect(finalBalance).toBeGreaterThanOrEqual(0);
  });
});
