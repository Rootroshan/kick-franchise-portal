"use server";

import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { csvCell } from "@/lib/csv";

export type BulkExportResult = { ok: boolean; message: string; csv?: string };

/**
 * Exports selected payments (Orders) as a CSV download.
 *
 * Returns base64-encoded CSV data that the client decodes and triggers as a
 * download — same pattern as bulkExportAuditLogsAction. Payments are
 * financial records, so the only bulk action offered here is export; there is
 * deliberately no bulk delete/status-change for money-movement rows.
 * KICK_ADMIN only.
 */
export async function bulkExportPaymentsAction(orderIds: string[]): Promise<BulkExportResult> {
  if (!orderIds.length) return { ok: false, message: "No payments selected." };

  const ctx = await requireRole("KICK_ADMIN")();

  const orders = await withTenant(ctx, (tx) =>
    tx.order.findMany({
      where: { id: { in: orderIds } },
      include: { tenant: { select: { name: true } }, location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })
  );

  const headers = [
    "Order ID",
    "Status",
    "Brand",
    "Store",
    "Subtotal",
    "Allowance Applied",
    "Card Charged",
    "Refunded",
    "Currency",
    "Stripe Payment Intent",
    "Created At",
  ];
  const csvRows = [
    headers.join(","),
    ...orders.map((o) =>
      [
        o.id,
        o.status,
        csvCell(o.tenant.name),
        csvCell(o.location.name),
        (o.subtotalCents / 100).toFixed(2),
        (o.allowanceAppliedCents / 100).toFixed(2),
        (o.cardChargedCents / 100).toFixed(2),
        (o.refundedCents / 100).toFixed(2),
        o.currency,
        o.stripePaymentIntentId ?? "",
        o.createdAt.toISOString(),
      ].join(",")
    ),
  ];

  const csv = csvRows.join("\n");
  // Encode as base64 so it serializes cleanly across the server action boundary.
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return { ok: true, message: `${orders.length} payment${orders.length === 1 ? "" : "s"} exported.`, csv: base64 };
}
