import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { listPayments, getPaymentKpis } from "@/server/modules/payments/service";

/**
 * Payments is a projection over Order, which is commerce data — the one
 * category FRANCHISOR_ADMIN must never reach. These tests exercise the service
 * directly with a franchisor context, so they prove the DATABASE denies it
 * rather than merely that a route guard is present.
 */
describe("Payments are locked out from franchisors", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("a franchisor sees zero payments even with orders present", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 10_000,
          allowanceAppliedCents: 4_000,
          cardChargedCents: 6_000,
          idempotencyKey: "test-key-1",
          placedBy: "seed-user",
        },
      })
    );

    // KICK_ADMIN can see it...
    const asKick = await listPayments(kickCtx(), { page: 1, limit: 20 });
    expect(asKick.total).toBe(1);

    // ...the brand's own franchisor cannot, despite it being their tenant.
    const asFranchisor = await listPayments(franchisorCtx(tenant.id), { page: 1, limit: 20 });
    expect(asFranchisor.total).toBe(0);
    expect(asFranchisor.rows).toHaveLength(0);
  });

  it("payment KPIs read zero for a franchisor", async () => {
    const { tenant, location } = await seedTenantWithLocation();

    await withTenant(kickCtx(), (tx) =>
      tx.order.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          status: "PAID",
          subtotalCents: 5_000,
          allowanceAppliedCents: 0,
          cardChargedCents: 5_000,
          idempotencyKey: "test-key-2",
          placedBy: "seed-user",
        },
      })
    );

    expect((await getPaymentKpis(kickCtx())).cardVolumeCents).toBe(5_000);
    // Aggregates must not leak totals either — a sum over hidden rows is still
    // a disclosure.
    expect((await getPaymentKpis(franchisorCtx(tenant.id))).cardVolumeCents).toBe(0);
  });
});
