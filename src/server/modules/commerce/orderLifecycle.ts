import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { accrueRebatesForOrder } from "@/server/modules/rebates/accrual";
import { appendLedgerCredit } from "@/server/modules/allowances/ledger";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { notifyOrderEvent } from "./orderNotifications";

/**
 * Marks an order PAID (called from the Stripe webhook on
 * payment_intent.succeeded, or directly from checkout() when no card
 * remainder existed). Accrues rebates. Idempotent: if the order is already
 * PAID, this is a no-op (duplicate webhook safe).
 */
export async function markOrderPaid(orderId: string, cardChargedCents: number) {
  const updated = await withTenant(systemKickContext(), async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    // Any status past PENDING means this payment was already processed (or the
    // order has since moved through fulfilment) — duplicate webhook delivery.
    if (order.status !== "PENDING") {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", cardChargedCents, paidAt: new Date() },
    });

    await accrueRebatesForOrder(tx, orderId);

    await writeAuditLog(tx, {
      tenantId: order.tenantId,
      actorId: "stripe-webhook",
      role: "KICK_ADMIN",
      action: "order.paid",
      entity: "Order",
      entityId: orderId,
      after: { status: "PAID", cardChargedCents },
    });

    return updated;
  });

  if (updated.status === "PAID") {
    await notifyOrderEvent(orderId, "paid");
  }
  return updated;
}

export async function markOrderFailed(orderId: string) {
  const updated = await withTenant(systemKickContext(), async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PENDING") return order;

    // Compensate: the allowance portion was tentatively debited at checkout
    // time; since the card leg failed, credit it back so the store isn't
    // charged an allowance debit for an order that never completed.
    const ledgerEntries = await tx.allowanceLedger.findMany({ where: { orderId } });
    for (const entry of ledgerEntries.filter((l) => l.reason === "ORDER_DEBIT")) {
      await appendLedgerCredit(tx, {
        allowanceId: entry.allowanceId,
        orderId,
        deltaCents: Math.abs(entry.deltaCents),
        reason: "REFUND_CREDIT",
      });
    }

    const updated = await tx.order.update({ where: { id: orderId }, data: { status: "FAILED" } });

    await writeAuditLog(tx, {
      tenantId: order.tenantId,
      actorId: "stripe-webhook",
      role: "KICK_ADMIN",
      action: "order.paymentFailed",
      entity: "Order",
      entityId: orderId,
      after: { status: "FAILED" },
    });

    return updated;
  });

  if (updated.status === "FAILED") {
    await notifyOrderEvent(orderId, "payment_failed");
  }
  return updated;
}

/**
 * Full or partial refund. Creates a compensating positive ledger entry for
 * the allowance portion refunded (proportional to the refund amount) and
 * updates order status. Never edits the original debit row.
 */
export async function refundOrder(orderId: string, refundAmountCents: number, actorId = "stripe-webhook") {
  const result = await withTenant(systemKickContext(), async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const totalRefundable = order.subtotalCents - order.refundedCents;
    const clampedRefund = Math.min(refundAmountCents, totalRefundable);
    if (clampedRefund <= 0) return { order, refunded: false };

    const isFullRefund = order.refundedCents + clampedRefund >= order.subtotalCents;

    // Refund proportionally from allowance-applied vs card-charged, in that
    // order (allowance first, matching how it was applied at checkout).
    const allowancePortion = Math.min(clampedRefund, order.allowanceAppliedCents);

    if (allowancePortion > 0) {
      const ledgerEntries = await tx.allowanceLedger.findMany({ where: { orderId, reason: "ORDER_DEBIT" } });
      const allowanceId = ledgerEntries[0]?.allowanceId;
      if (allowanceId) {
        await appendLedgerCredit(tx, {
          allowanceId,
          orderId,
          deltaCents: allowancePortion,
          reason: "REFUND_CREDIT",
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        refundedCents: order.refundedCents + clampedRefund,
        status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        ...(isFullRefund ? { refundedAt: new Date() } : {}),
      },
    });

    await writeAuditLog(tx, {
      tenantId: order.tenantId,
      actorId,
      role: "KICK_ADMIN",
      action: "order.refund",
      entity: "Order",
      entityId: orderId,
      before: { refundedCents: order.refundedCents, status: order.status },
      after: { refundedCents: updated.refundedCents, status: updated.status, refundAmountCents: clampedRefund },
    });

    return { order: updated, refunded: true };
  });

  if (result.refunded) {
    await notifyOrderEvent(orderId, "refunded");
  }
  return result.order;
}

export async function getOrderByPaymentIntentId(paymentIntentId: string) {
  return withTenant(systemKickContext(), (tx) => tx.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId } }));
}
