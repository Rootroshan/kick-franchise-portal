import type { OrderStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { appendLedgerCredit } from "@/server/modules/allowances/ledger";
import { stripeClient } from "@/server/lib/stripe";
import { CARRIERS } from "@/lib/orderStatus";
import { notifyOrderEvent } from "./orderNotifications";

/**
 * KICK_ADMIN-only fulfilment state machine. Each transition:
 *   - validates the current status (invalid transitions are 409s, never writes),
 *   - stamps the matching lifecycle timestamp,
 *   - writes an audit log,
 *   - notifies the store's members (in-app + push, deduplicated).
 *
 * Payment states (PAID/FAILED/REFUNDED) stay owned by the Stripe webhook in
 * orderLifecycle.ts — nothing here ever marks an order paid.
 *
 * Lifecycle: PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
 * Terminal:  CANCELLED, REFUNDED, FAILED
 */

function requireKick(ctx: RequestContext) {
  if (ctx.role !== "KICK_ADMIN") throw new HttpError(403, "Forbidden");
}

const TRACKING_NUMBER_RE = /^[A-Za-z0-9 \-]{4,40}$/;

async function transition(
  ctx: RequestContext,
  orderId: string,
  opts: {
    from: OrderStatus[];
    to: OrderStatus;
    action: string;
    data?: Record<string, unknown>;
  }
) {
  requireKick(ctx);
  return withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new HttpError(404, "Order not found");
    if (!opts.from.includes(order.status)) {
      throw new HttpError(409, `Order is ${order.status} — cannot ${opts.action}`, "INVALID_TRANSITION");
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: opts.to, ...opts.data },
    });

    await writeAuditLog(tx, {
      tenantId: order.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: `order.${opts.action}`,
      entity: "Order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: opts.to, ...opts.data },
    });

    return updated;
  });
}

export async function markOrderProcessing(ctx: RequestContext, orderId: string) {
  const order = await transition(ctx, orderId, {
    from: ["PAID"],
    to: "PROCESSING",
    action: "processing",
    data: { processingAt: new Date() },
  });
  await notifyOrderEvent(orderId, "processing");
  return order;
}

export type ShipmentInput = { carrier: string; trackingNumber: string; estimatedDeliveryAt?: Date | null };

export async function markOrderShipped(ctx: RequestContext, orderId: string, shipment: ShipmentInput) {
  if (!CARRIERS[shipment.carrier]) {
    throw new HttpError(422, "Unknown carrier", "INVALID_CARRIER");
  }
  const trackingNumber = shipment.trackingNumber.trim();
  if (!TRACKING_NUMBER_RE.test(trackingNumber)) {
    throw new HttpError(422, "Tracking number must be 4–40 letters, digits, spaces or dashes", "INVALID_TRACKING_NUMBER");
  }

  const order = await transition(ctx, orderId, {
    from: ["PAID", "PROCESSING"],
    to: "SHIPPED",
    action: "shipped",
    data: {
      shippedAt: new Date(),
      carrier: shipment.carrier,
      trackingNumber,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt ?? null,
    },
  });
  await notifyOrderEvent(orderId, "shipped");
  return order;
}

export async function markOrderDelivered(ctx: RequestContext, orderId: string) {
  const order = await transition(ctx, orderId, {
    from: ["SHIPPED"],
    to: "DELIVERED",
    action: "delivered",
    data: { deliveredAt: new Date() },
  });
  await notifyOrderEvent(orderId, "delivered");
  return order;
}

/**
 * Admin cancellation. Only orders whose money can be fully unwound without a
 * card refund are cancellable here: PENDING (nothing captured yet) or
 * PAID/PROCESSING with a zero card charge (allowance-only). The allowance
 * debit is reversed with a compensating credit (the original debit row is
 * never edited). Card-charged orders must go through the Refund flow, whose
 * status change stays webhook-authoritative — a "cancel" that silently kept
 * the store's card money would be worse than the extra click.
 */
export async function cancelOrder(ctx: RequestContext, orderId: string) {
  requireKick(ctx);

  const cancelled = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new HttpError(404, "Order not found");
    const cancellable =
      order.status === "PENDING" || ((order.status === "PAID" || order.status === "PROCESSING") && order.cardChargedCents === 0);
    if (!cancellable) {
      throw new HttpError(
        409,
        order.cardChargedCents > 0 ? "This order has a card charge — issue a refund instead" : `Order is ${order.status} — cannot cancel`,
        "INVALID_TRANSITION"
      );
    }

    // Reverse the allowance debit taken at checkout.
    const debits = await tx.allowanceLedger.findMany({ where: { orderId, reason: "ORDER_DEBIT" } });
    for (const entry of debits) {
      await appendLedgerCredit(tx, {
        allowanceId: entry.allowanceId,
        orderId,
        deltaCents: Math.abs(entry.deltaCents),
        reason: "REFUND_CREDIT",
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await writeAuditLog(tx, {
      tenantId: order.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "order.cancelled",
      entity: "Order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: "CANCELLED" },
    });

    return updated;
  });

  // A PENDING order may still have an uncaptured PaymentIntent — cancel it in
  // Stripe so the card can never be charged for a cancelled order. Best-effort:
  // an already-cancelled/absent intent shouldn't fail the cancellation.
  if (cancelled.stripePaymentIntentId && cancelled.cardChargedCents === 0) {
    try {
      await (await stripeClient()).paymentIntents.cancel(cancelled.stripePaymentIntentId);
    } catch (err) {
      console.error(`Could not cancel Stripe PaymentIntent for order ${orderId}:`, err);
    }
  }

  await notifyOrderEvent(orderId, "cancelled");
  return cancelled;
}

/**
 * Full refund of everything still refundable, admin-initiated. The card
 * portion is refunded THROUGH STRIPE (previously the admin action only edited
 * our DB — the store's card was never actually credited); the ledger/status
 * update runs immediately via refundOrder(), and the eventual
 * charge.refunded webhook no-ops because refundedCents is already up to date
 * (refundOrder clamps to the remaining refundable amount).
 */
export async function adminRefundOrder(ctx: RequestContext, orderId: string) {
  requireKick(ctx);

  const order = await withTenant(ctx, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw new HttpError(404, "Order not found");
  const remaining = order.subtotalCents - order.refundedCents;
  if (remaining <= 0) throw new HttpError(409, "Nothing left to refund", "NOTHING_TO_REFUND");

  // refundOrder() credits allowance-first, so the card portion already
  // refunded is whatever refundedCents exceeds the allowance applied.
  const cardAlreadyRefunded = Math.max(0, order.refundedCents - order.allowanceAppliedCents);
  const cardRefundable = Math.max(0, order.cardChargedCents - cardAlreadyRefunded);

  if (cardRefundable > 0 && order.stripePaymentIntentId) {
    await (await stripeClient()).refunds.create(
      { payment_intent: order.stripePaymentIntentId, amount: cardRefundable },
      // Keyed on the pre-refund state: a double-click retries idempotently,
      // while a later legitimate second refund (new refundedCents) gets a new key.
      { idempotencyKey: `refund_${orderId}_${order.refundedCents}` }
    );
  }

  const { refundOrder } = await import("./orderLifecycle");
  return refundOrder(orderId, remaining, ctx.userId);
}
