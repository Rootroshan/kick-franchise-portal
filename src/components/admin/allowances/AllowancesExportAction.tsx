"use client";

import { Download } from "lucide-react";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkExportAllowancesAction } from "@/app/admin/allowances/allowanceActions";

/**
 * Downloads the CSV a bulk-export action returns (base64-encoded, since the
 * payload has to cross the server-action boundary as a string). Shared shape
 * with the audit-log and payments export actions.
 */
function downloadCsv(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const allowancesExportAction: BulkActionDef = {
  key: "export",
  label: "Export CSV",
  icon: Download,
  tone: "default",
  action: async (ids) => {
    const result = await bulkExportAllowancesAction(ids);
    if (result.ok && result.csv) downloadCsv(result.csv, `allowances-${new Date().toISOString().slice(0, 10)}.csv`);
    return result;
  },
};
