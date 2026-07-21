"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { OrderStatus } from "@prisma/client";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

const CANCELLABLE_STATUSES = new Set<OrderStatus>([OrderStatus.PENDING, OrderStatus.PAID]);

export async function bulkCancelOrdersAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No orders selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const order = await tx.order.findUnique({ where: { id } });
        if (!order) throw new HttpError(404, "Order not found");
        const cancellable = CANCELLABLE_STATUSES.has(order.status);
        if (!cancellable) throw new HttpError(400, "Order cannot be cancelled");
        await tx.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/orders");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} order${ok === 1 ? "" : "s"} cancelled.` };
  if (ok === 0) return { ok: false, message: `Could not cancel ${fail} order${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} cancelled, ${fail} failed (already processed).` };
}
