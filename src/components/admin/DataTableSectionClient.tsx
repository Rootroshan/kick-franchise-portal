"use client";

import { BulkSelectionProvider } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { DataTable, type ColumnHeader, type ResolvedRow } from "@/components/admin/DataTable";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";

type Props = {
  rows: ResolvedRow[];
  headers: ColumnHeader[];
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty: { title: string; description?: string };
  actions: BulkActionDef[];
  itemName: string;
  total: number;
};

/** Client half of DataTableSection — takes only already-resolved (plain) row data. */
export function DataTableSectionClient(props: Props) {
  return (
    <BulkSelectionProvider>
      <DataTableSectionClientInner {...props} />
    </BulkSelectionProvider>
  );
}

function DataTableSectionClientInner({
  rows,
  headers,
  basePath,
  currentParams,
  sort,
  direction,
  empty,
  actions,
  itemName,
  total,
}: Props) {
  // No point rendering checkboxes for a list with nothing to bulk-act on —
  // e.g. Allowances/Rebates, whose rows are an append-only ledger view and a
  // computed-status rule list respectively, neither of which has a safe bulk
  // mutation. An empty actions array means "no bulk action exists here," not
  // "select rows and see an empty toolbar."
  const hasActions = actions.length > 0;

  return (
    <>
      {hasActions && <BulkActionToolbar actions={actions} itemName={itemName} />}
      <DataTable
        columns={headers}
        rows={rows}
        basePath={basePath}
        currentParams={currentParams}
        sort={sort}
        direction={direction}
        empty={empty}
        selectable={hasActions}
        totalFiltered={total}
      />
    </>
  );
}
