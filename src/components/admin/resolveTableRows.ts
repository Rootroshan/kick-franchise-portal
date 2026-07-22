import type { Column, ColumnHeader, ResolvedRow } from "@/components/admin/DataTable";

/**
 * Resolves a `Column<Row>[]` + `rows` (and optional `rowHref`) into the plain
 * data `DataTable` (a Client Component) actually renders.
 *
 * Call this from a Server Component, before the result reaches `<DataTable>`.
 * `Column.cell` (and `rowHref`) are functions — functions can't be passed
 * from a Server Component into a Client Component, only serializable data
 * (strings, rendered ReactNodes) can. This runs the callbacks here, server-side,
 * and hands the client component only their already-computed output.
 */
export function resolveTableRows<Row>(
  columns: Column<Row>[],
  rows: Row[],
  rowKey: (row: Row) => string,
  rowHref?: (row: Row) => string
): { columns: ColumnHeader[]; rows: ResolvedRow[] } {
  const headers = columns.map(({ cell: _cell, ...header }) => header);
  const resolvedRows = rows.map((row) => ({
    id: rowKey(row),
    href: rowHref?.(row),
    cells: columns.map((col) => col.cell(row)),
  }));
  return { columns: headers, rows: resolvedRows };
}
