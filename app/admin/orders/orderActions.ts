"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { cancelOrder } from "@/server/modules/commerce/fulfilment";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

/**
 * Bulk cancel routes through the fulfilment state machine so every order gets
 * the full treatment: transition validation, allowance-ledger reversal,
 * Stripe PaymentIntent void, audit log and store notification. (The previous
 * version flipped status directly — no ledger credit, no notification, and it
 * would "cancel" card-charged orders while keeping the store's money.)
 */
export async function bulkCancelOrdersAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No orders selected." };
  const ctx = await requireRole("KICK_ADMIN")();

  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await cancelOrder(ctx, id);
      ok++;
    } catch {
      fail++;
    }
  }

  revalidatePath("/admin/orders");
  if (fail === 0) return { ok: true, message: `${ok} order${ok === 1 ? "" : "s"} cancelled.` };
  if (ok === 0) return { ok: false, message: `Could not cancel ${fail} order${fail === 1 ? "" : "s"} (already processed or card-charged — use refund).` };
  return { ok: true, partial: true, message: `${ok} cancelled, ${fail} failed (already processed or card-charged — use refund).` };
}
