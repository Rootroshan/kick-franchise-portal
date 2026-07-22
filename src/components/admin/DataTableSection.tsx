import { DataTableSectionClient } from "@/components/admin/DataTableSectionClient";
import { resolveTableRows } from "@/components/admin/resolveTableRows";
import type { Column } from "@/components/admin/DataTable";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";

type Props<Row> = {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  rowHref?: (row: Row) => string;
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty: { title: string; description?: string };
  actions: BulkActionDef[];
  itemName: string;
  total: number;
};

/**
 * Server Component. Resolves each row's `cell`/`rowKey`/`rowHref` callbacks
 * into plain data (rendered nodes, strings) here, before handing off to the
 * "use client" table below — functions can't be passed from a Server
 * Component into a Client Component, only serializable data can.
 */
export function DataTableSection<Row>({
  rows,
  columns,
  rowKey,
  rowHref,
  basePath,
  currentParams,
  sort,
  direction,
  empty,
  actions,
  itemName,
  total,
}: Props<Row>) {
  const { columns: headers, rows: resolvedRows } = resolveTableRows(columns, rows, rowKey, rowHref);

  return (
    <DataTableSectionClient
      headers={headers}
      rows={resolvedRows}
      basePath={basePath}
      currentParams={currentParams}
      sort={sort}
      direction={direction}
      empty={empty}
      actions={actions}
      itemName={itemName}
      total={total}
    />
  );
}
