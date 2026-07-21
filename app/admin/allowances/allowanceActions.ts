"use server";

import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { balanceOf, usedOf } from "@/server/modules/allowances/listView";

export type BulkExportResult = { ok: boolean; message: string; csv?: string };

/**
 * Exports selected allowances as a CSV download.
 *
 * Allowances are an append-only ledger view — there is deliberately no bulk
 * delete/status-change here, only export. KICK_ADMIN only.
 */
export async function bulkExportAllowancesAction(ids: string[]): Promise<BulkExportResult> {
  if (!ids.length) return { ok: false, message: "No allowances selected." };

  const ctx = await requireRole("KICK_ADMIN")();

  const items = await withTenant(ctx, (tx) =>
    tx.allowance.findMany({
      where: { id: { in: ids } },
      include: { tenant: { select: { name: true } }, location: { select: { name: true } }, ledger: { select: { deltaCents: true, reason: true } } },
      orderBy: { createdAt: "desc" },
    })
  );

  const headers = ["Brand", "Store", "Period", "Granted", "Used", "Balance", "Currency"];
  const csvRows = [
    headers.join(","),
    ...items.map((a) =>
      [
        `"${a.tenant.name.replace(/"/g, '""')}"`,
        `"${a.location.name.replace(/"/g, '""')}"`,
        a.periodLabel,
        (a.grantedCents / 100).toFixed(2),
        (usedOf(a.ledger) / 100).toFixed(2),
        (balanceOf(a.grantedCents, a.ledger) / 100).toFixed(2),
        a.currency,
      ].join(",")
    ),
  ];

  const csv = csvRows.join("\n");
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return { ok: true, message: `${items.length} allowance${items.length === 1 ? "" : "s"} exported.`, csv: base64 };
}
