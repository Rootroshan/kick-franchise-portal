"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { markOrderProcessing, markOrderShipped, markOrderDelivered, cancelOrder, adminRefundOrder } from "@/server/modules/commerce/fulfilment";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * KICK_ADMIN fulfilment server actions. Thin wrappers: role check + the
 * fulfilment state machine (which validates transitions, audits and notifies
 * the store) + cache revalidation. Errors surface as messages for the toast.
 */

function revalidate(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

async function run(orderId: string, fn: () => Promise<unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    await fn();
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, message: e.message };
    console.error("Fulfilment action failed:", e);
    return { ok: false, message: "Something went wrong — try again." };
  }
}

export async function markProcessingAction(orderId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  return run(orderId, () => markOrderProcessing(ctx, orderId));
}

export async function markShippedAction(orderId: string, input: { carrier: string; trackingNumber: string; estimatedDeliveryAt?: string }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const eta = input.estimatedDeliveryAt ? new Date(`${input.estimatedDeliveryAt}T12:00:00`) : null;
  return run(orderId, () =>
    markOrderShipped(ctx, orderId, {
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      estimatedDeliveryAt: eta && !Number.isNaN(eta.getTime()) ? eta : null,
    })
  );
}

export async function markDeliveredAction(orderId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  return run(orderId, () => markOrderDelivered(ctx, orderId));
}

export async function cancelOrderAction(orderId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  return run(orderId, () => cancelOrder(ctx, orderId));
}

export async function refundOrderAction(orderId: string) {
  const ctx = await requireRole("KICK_ADMIN")();
  return run(orderId, () => adminRefundOrder(ctx, orderId));
}
