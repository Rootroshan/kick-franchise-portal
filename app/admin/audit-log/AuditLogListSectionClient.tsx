"use client";

import { BulkSelectionProvider } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { DataTable, type ColumnHeader, type ResolvedRow } from "@/components/admin/DataTable";
import { Download } from "lucide-react";
import { bulkExportAuditLogsAction } from "./auditLogActions";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";

type Props = {
  rows: ResolvedRow[];
  headers: ColumnHeader[];
  total: number;
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty: { title: string; description?: string };
};

/**
 * Client wrapper for audit log with bulk export. Takes only already-resolved
 * (plain) row data — see AuditLogListSection for why.
 */
export function AuditLogListSectionClient(props: Props) {
  return (
    <BulkSelectionProvider>
      <AuditLogListSectionClientInner {...props} />
    </BulkSelectionProvider>
  );
}

function AuditLogListSectionClientInner({
  rows,
  headers,
  total,
  basePath,
  currentParams,
  sort,
  direction,
  empty,
}: Props) {
  // The export action is defined here (not inline in the array literal) to keep
  // this file as a valid client component. The action calls the server action
  // and then triggers a browser download from the base64-encoded CSV payload.
  const exportAction: BulkActionDef = {
    key: "export",
    label: "Export CSV",
    icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
    tone: "default",
    action: async (ids) => {
      const result = await bulkExportAuditLogsAction(ids);
      if (result.ok && result.csv) {
        const binary = atob(result.csv);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      return result;
    },
  };

  return (
    <>
      <BulkActionToolbar actions={[exportAction]} itemName="log" />
      <DataTable
        columns={headers}
        rows={rows}
        basePath={basePath}
        currentParams={currentParams}
        sort={sort}
        direction={direction}
        empty={empty}
        selectable
        totalFiltered={total}
      />
    </>
  );
}
