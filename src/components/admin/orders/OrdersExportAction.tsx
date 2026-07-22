"use client";

import { Download } from "lucide-react";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkExportPaymentsAction } from "@/app/admin/payments/paymentActions";

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

// Reuses bulkExportPaymentsAction — it's already order-scoped (Orders and
// Payments are the same underlying rows) and CSV-injection-safe (csvCell()),
// so there's no need for a second, duplicate export implementation. Defined
// in its own "use client" file (matching AllowancesExportAction.tsx /
// RebatesExportAction.tsx) so the browser-only download logic never has to
// cross the server->client boundary from the orders page's Server Component.
export const ordersExportAction: BulkActionDef = {
  key: "export",
  label: "Export CSV",
  icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
  tone: "default",
  action: async (ids) => {
    const result = await bulkExportPaymentsAction(ids);
    if (result.ok && result.csv) downloadCsv(result.csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
    return result;
  },
};
