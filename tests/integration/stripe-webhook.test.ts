import { describe, it, expect, beforeEach } from "vitest";
import Stripe from "stripe";
import type { OrderStatus } from "@prisma/client";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { POST } from "@/app/api/webhooks/stripe/route";

const WEBHOOK_SECRET = "whsec_test_secret_for_signature_verification";

function signedRequest(payload: object): Request {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body,
  });
}

async function seedOrder(tenantId: string, locationId: string, overrides: Partial<{ status: OrderStatus; stripePaymentIntentId: string; subtotalCents: number; allowanceAppliedCents: number }> = {}) {
  return withTenant(kickCtx(), (tx) =>
    tx.order.create({
      data: {
        tenantId,
        locationId,
        status: overrides.status ?? "PENDING",
        subtotalCents: overrides.subtotalCents ?? 5000,
        allowanceAppliedCents: overrides.allowanceAppliedCents ?? 0,
        cardChargedCents: 0,
        currency: "CAD",
        stripePaymentIntentId: overrides.stripePaymentIntentId ?? `pi_test_${Math.random().toString(36).slice(2)}`,
        idempotencyKey: `key-${Math.random().toString(36).slice(2)}`,
        placedBy: "seed",
      },
    })
  );
}

describe("Stripe webhook route: signature verification + idempotency", () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("rejects a request with no stripe-signature header", async () => {
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ id: "evt_x", type: "payment_intent.succeeded" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects a request with an invalid/forged signature", async () => {
    const body = JSON.stringify({ id: "evt_forged", type: "payment_intent.succeeded", data: { object: {} } });
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeefnotarealsignature" },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("payment_intent.succeeded marks the matching order PAID exactly once, and records the event as processed", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const order = await seedOrder(tenant.id, location.id, { status: "PENDING", subtotalCents: 4000, allowanceAppliedCents: 1000 });

    const event = {
      id: `evt_${Math.random().toString(36).slice(2)}`,
      type: "payment_intent.succeeded",
      data: { object: { id: order.stripePaymentIntentId, amount_received: 3000, amount: 3000 } },
    };

    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    const updated = await withTenant(kickCtx(), (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(updated.status).toBe("PAID");
    expect(updated.cardChargedCents).toBe(3000);
    expect(updated.paidAt).not.toBeNull();

    const processed = await withTenant(kickCtx(), (tx) => tx.processedStripeEvent.findUnique({ where: { id: event.id } }));
    expect(processed).not.toBeNull();
  });

  it("redelivering the SAME event id is idempotent — order state and processed-event count do not change on a second delivery", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const order = await seedOrder(tenant.id, location.id, { status: "PENDING", subtotalCents: 2000, allowanceAppliedCents: 0 });

    const event = {
      id: `evt_dup_${Math.random().toString(36).slice(2)}`,
      type: "payment_intent.succeeded",
      data: { object: { id: order.stripePaymentIntentId, amount_received: 2000, amount: 2000 } },
    };

    const first = await POST(signedRequest(event));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.duplicate).toBeUndefined();

    const second = await POST(signedRequest(event));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBe(true);

    const updated = await withTenant(kickCtx(), (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(updated.status).toBe("PAID");
    expect(updated.cardChargedCents).toBe(2000); // not double-applied

    const processedCount = await withTenant(kickCtx(), (tx) => tx.processedStripeEvent.count({ where: { id: event.id } }));
    expect(processedCount).toBe(1);
  });

  it("payment_intent.payment_failed marks the order FAILED and credits back any tentative allowance debit", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const order = await seedOrder(tenant.id, location.id, { status: "PENDING", subtotalCents: 6000, allowanceAppliedCents: 2000 });
    // Simulate the tentative allowance debit checkout() would have written.
    const allowance = await withTenant(kickCtx(), (tx) =>
      tx.allowance.create({ data: { tenantId: tenant.id, locationId: location.id, periodLabel: "2026-Q3", grantedCents: 5000, overflow: "CHARGE_CARD", createdBy: "seed" } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.allowanceLedger.create({ data: { allowanceId: allowance.id, orderId: order.id, deltaCents: -2000, balanceAfter: 3000, reason: "ORDER_DEBIT" } })
    );

    const event = {
      id: `evt_failed_${Math.random().toString(36).slice(2)}`,
      type: "payment_intent.payment_failed",
      data: { object: { id: order.stripePaymentIntentId } },
    };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);

    const updated = await withTenant(kickCtx(), (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(updated.status).toBe("FAILED");

    const balance = await withTenant(kickCtx(), async (tx) => {
      const agg = await tx.allowanceLedger.aggregate({ where: { allowanceId: allowance.id }, _sum: { deltaCents: true } });
      return agg._sum.deltaCents ?? 0;
    });
    expect(balance).toBe(0); // -2000 debit + 2000 compensating credit
  });

  it("charge.refunded processes a refund against the matching order via its payment_intent id", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const order = await seedOrder(tenant.id, location.id, { status: "PAID", subtotalCents: 5000, allowanceAppliedCents: 0 });
    await withTenant(kickCtx(), (tx) => tx.order.update({ where: { id: order.id }, data: { cardChargedCents: 5000, paidAt: new Date() } }));

    const event = {
      id: `evt_refund_${Math.random().toString(36).slice(2)}`,
      type: "charge.refunded",
      data: { object: { payment_intent: order.stripePaymentIntentId, amount_refunded: 5000 } },
    };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);

    const updated = await withTenant(kickCtx(), (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }));
    expect(updated.refundedCents).toBe(5000);
    expect(updated.status).toBe("REFUNDED");
  });

  it("an event for an unknown payment_intent id is acknowledged without throwing (no matching order)", async () => {
    const event = {
      id: `evt_unknown_${Math.random().toString(36).slice(2)}`,
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_does_not_exist_anywhere", amount_received: 100 } },
    };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
  });
});
