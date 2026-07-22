"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { buildHref } from "@/lib/adminQuery";
import { EmptyState } from "./kit";
import { useBulkSelection } from "./bulk/BulkSelection";
import { BulkCheckbox, BulkSelectAll } from "./bulk/BulkCheckbox";

export type Column<Row> = {
  key: string;
  header: string;
  /** Render cell content. Called server-side only — never passed across the client boundary. */
  cell: (row: Row) => ReactNode;
  /** If set, header becomes a sort link writing ?sort=<sortKey>. */
  sortKey?: string;
  className?: string;
  /** Hide below `sm` to keep mobile tables readable. */
  hideOnMobile?: boolean;
};

/** Column header metadata only — no `cell`, since that never crosses into the client component. */
export type ColumnHeader = Omit<Column<never>, "cell">;

/**
 * A single already-rendered row, resolved server-side from `Column.cell` /
 * `rowKey` / `rowHref` callbacks. React elements and strings are plain
 * serializable data, so — unlike the callbacks that produced them — this is
 * safe to pass from a Server Component into this Client Component.
 */
export type ResolvedRow = {
  id: string;
  href?: string;
  cells: ReactNode[];
};

type DataTableProps = {
  columns: ColumnHeader[];
  rows: ResolvedRow[];
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty?: { title: string; description?: string };
  /** Enable bulk selection checkboxes */
  selectable?: boolean;
  /** Total filtered count (for "select all X" label) */
  totalFiltered?: number;
};

/**
 * Generic client-rendered table with optional bulk selection.
 * - `selectable` enables checkboxes and syncs with BulkSelectionProvider.
 *   Only reads that context when `selectable` is true (via BulkSelectionSync
 *   below), so non-selectable callers don't need a BulkSelectionProvider
 *   ancestor at all.
 * - Sorting is URL-driven (?sort=&direction=).
 *
 * Takes pre-resolved rows/headers (plain data), not the row-mapping functions
 * that produced them — functions can't be passed from a Server Component
 * (e.g. an admin `page.tsx`) into this Client Component. Callers should go
 * through `DataTableSection` (or `resolveTableRows` directly), which does
 * that resolution server-side.
 */
export function DataTable({
  columns,
  rows,
  basePath,
  currentParams,
  sort,
  direction,
  empty,
  selectable = false,
  totalFiltered,
}: DataTableProps) {
  if (rows.length === 0) {
    return <EmptyState title={empty?.title ?? "Nothing here yet"} description={empty?.description} />;
  }

  const total = totalFiltered ?? rows.length;
  const allIds = rows.map((r) => r.id);

  return (
    <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <BulkSelectAll
                  allIds={allIds}
                  totalFiltered={total}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 font-medium ${col.hideOnMobile ? "hidden sm:table-cell" : ""} ${col.className ?? ""}`}
              >
                {col.sortKey ? (
                  <SortHeader
                    label={col.header}
                    sortKey={col.sortKey}
                    active={sort === col.sortKey}
                    direction={direction}
                    basePath={basePath}
                    currentParams={currentParams}
                  />
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {selectable && <BulkSelectionSync ids={allIds} totalFiltered={total} />}
          {rows.map((row) => (
            <DataRow key={row.id} row={row} columns={columns} selectable={selectable} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders one row. Split into selectable/plain variants (rather than
 * conditionally calling useBulkSelection) so non-selectable tables never
 * call that hook and never need a BulkSelectionProvider ancestor.
 */
function DataRow({ row, columns, selectable }: { row: ResolvedRow; columns: ColumnHeader[]; selectable: boolean }) {
  return selectable ? (
    <SelectableDataRow row={row} columns={columns} />
  ) : (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-muted/30">
      <RowCells row={row} columns={columns} />
    </tr>
  );
}

function SelectableDataRow({ row, columns }: { row: ResolvedRow; columns: ColumnHeader[] }) {
  const { isSelected } = useBulkSelection();
  const selected = isSelected(row.id);
  return (
    <tr
      className={`border-b border-border last:border-0 transition-colors ${
        selected ? "bg-status-info/5" : "hover:bg-muted/30"
      }`}
    >
      <td className="w-10 px-3 py-2.5 align-middle">
        <BulkCheckbox id={row.id} />
      </td>
      <RowCells row={row} columns={columns} />
    </tr>
  );
}

function RowCells({ row, columns }: { row: ResolvedRow; columns: ColumnHeader[] }) {
  return (
    <>
      {columns.map((col, i) => {
        const content = row.cells[i];
        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 align-middle ${col.hideOnMobile ? "hidden sm:table-cell" : ""} ${col.className ?? ""}`}
          >
            {row.href ? (
              <Link href={row.href} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </td>
        );
      })}
    </>
  );
}

/** Invisible row: syncs the current page's ids into BulkSelectionProvider. Only mounted when `selectable`. */
function BulkSelectionSync({ ids, totalFiltered }: { ids: string[]; totalFiltered: number }) {
  const { setPage } = useBulkSelection();
  useEffect(() => {
    setPage(ids, totalFiltered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), totalFiltered, setPage]);
  return null;
}

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  basePath,
  currentParams,
}: {
  label: string;
  sortKey: string;
  active: boolean;
  direction?: "asc" | "desc";
  basePath: string;
  currentParams: Record<string, string>;
}) {
  const nextDir = active && direction === "asc" ? "desc" : "asc";
  const href = buildHref(basePath, currentParams, { sort: sortKey, direction: nextDir, page: 1 });
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      {active ? (
        direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </Link>
  );
}
