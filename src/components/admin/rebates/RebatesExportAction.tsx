"use client";

import { Download } from "lucide-react";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkExportRebatesAction } from "@/app/admin/rebates/rebateActions";

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

export const rebatesExportAction: BulkActionDef = {
  key: "export",
  label: "Export CSV",
  icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
  tone: "default",
  action: async (ids) => {
    const result = await bulkExportRebatesAction(ids);
    if (result.ok && result.csv) downloadCsv(result.csv, `rebates-${new Date().toISOString().slice(0, 10)}.csv`);
    return result;
  },
};
