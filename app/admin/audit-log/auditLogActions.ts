"use server";

import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import type { AuditRow } from "@/server/modules/identity/auditList";
import { csvCell } from "@/lib/csv";

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

/**
 * Exports selected audit log entries as a CSV download.
 * Returns base64-encoded CSV data that the client decodes and triggers as a download.
 * KICK_ADMIN only.
 */
export async function bulkExportAuditLogsAction(ids: string[]): Promise<{ ok: boolean; message: string; csv?: string }> {
  if (!ids.length) return { ok: false, message: "No logs selected." };

  const ctx = await requireRole("KICK_ADMIN")();

  const rows = await withTenant(ctx, async (tx) => {
    const items = await tx.auditLog.findMany({
      where: { id: { in: ids } },
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return items.map((l): AuditRow => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      actorId: l.actorId,
      role: l.role,
      brandName: l.tenant?.name ?? null,
      ip: l.ip ?? null,
      createdAt: l.createdAt,
    }));
  });

  // Build CSV
  const headers = ["ID", "Action", "Entity", "Entity ID", "Actor", "Role", "Brand", "IP", "Created At"];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        csvCell(r.action),
        csvCell(r.entity),
        r.entityId ?? "",
        csvCell(r.actorId),
        r.role ?? "",
        csvCell(r.brandName ?? "Platform"),
        r.ip ?? "",
        r.createdAt.toISOString(),
      ].join(",")
    ),
  ];

  const csv = csvRows.join("\n");
  // Encode as base64 so it serializes cleanly across the server action boundary
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return { ok: true, message: `${rows.length} events exported.`, csv: base64 };
}

