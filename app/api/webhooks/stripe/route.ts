import { stripeClient } from "@/server/lib/stripe";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { markOrderPaid, markOrderFailed, refundOrder, getOrderByPaymentIntentId } from "@/server/modules/commerce/orderLifecycle";
import type Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook — the ONLY authoritative source for payment confirmation
 * (spec §13). Never mark an order paid based on client-reported success.
 * Signature-verified; processed event IDs are tracked in
 * ProcessedStripeEvent to guarantee idempotent handling of Stripe's
 * at-least-once delivery.
 */
export async function POST(req: Request) {
  const env = getEnv();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotent dedupe: if we've already processed this event id, ack and exit.
  const already = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (already) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const order = await getOrderByPaymentIntentId(intent.id);
        if (order) {
          await markOrderPaid(order.id, intent.amount_received ?? intent.amount);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const order = await getOrderByPaymentIntentId(intent.id);
        if (order) {
          await markOrderFailed(order.id);
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const order = await getOrderByPaymentIntentId(paymentIntentId);
          if (order) {
            await refundOrder(order.id, charge.amount_refunded);
          }
        }
        break;
      }
      default:
        break; // ignore other event types
    }

    await prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
    return Response.json({ received: true });
  } catch (err) {
    console.error(`Error processing Stripe webhook ${event.id} (${event.type}):`, err);
    // Return 500 so Stripe retries; do NOT record as processed on failure.
    return Response.json({ error: "Internal processing error" }, { status: 500 });
  }
}
