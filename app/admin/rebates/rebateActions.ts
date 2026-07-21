"use server";

import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { formatRebateValue } from "@/server/modules/rebates/admin";

export type BulkExportResult = { ok: boolean; message: string; csv?: string };

/**
 * Exports selected rebate rules as a CSV download.
 *
 * A rebate rule's "active" status is computed from its effective date range,
 * not a stored flag — there is no safe bulk activate/deactivate to offer, so
 * export is the only bulk action here. KICK_ADMIN only.
 */
export async function bulkExportRebatesAction(ids: string[]): Promise<BulkExportResult> {
  if (!ids.length) return { ok: false, message: "No rebate rules selected." };

  const ctx = await requireRole("KICK_ADMIN")();

  const rules = await withTenant(ctx, (tx) =>
    tx.rebateRule.findMany({
      where: { id: { in: ids } },
      include: { tenant: { select: { name: true } }, product: { select: { name: true } }, accruals: { select: { amountCents: true } } },
      orderBy: { effectiveFrom: "desc" },
    })
  );

  const now = new Date();
  const headers = ["Brand", "Product", "Type", "Value", "Effective From", "Effective To", "Active", "Accrued"];
  const csvRows = [
    headers.join(","),
    ...rules.map((r) => {
      const isActive = r.effectiveFrom <= now && (!r.effectiveTo || r.effectiveTo >= now);
      const accruedCents = r.accruals.reduce((s, a) => s + a.amountCents, 0);
      return [
        `"${r.tenant.name.replace(/"/g, '""')}"`,
        `"${r.product.name.replace(/"/g, '""')}"`,
        r.type,
        formatRebateValue(r.type, r.value),
        r.effectiveFrom.toISOString(),
        r.effectiveTo ? r.effectiveTo.toISOString() : "ongoing",
        isActive ? "yes" : "no",
        (accruedCents / 100).toFixed(2),
      ].join(",");
    }),
  ];

  const csv = csvRows.join("\n");
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return { ok: true, message: `${rules.length} rebate rule${rules.length === 1 ? "" : "s"} exported.`, csv: base64 };
}
