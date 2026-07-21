import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { buildHref } from "@/lib/adminQuery";
import { EmptyState } from "./kit";

export type Column<Row> = {
  key: string;
  header: string;
  /** Render cell content. */
  cell: (row: Row) => ReactNode;
  /** If set, header becomes a sort link writing ?sort=<sortKey>. */
  sortKey?: string;
  className?: string;
  /** Hide below `sm` to keep mobile tables readable. */
  hideOnMobile?: boolean;
};

/**
 * Generic server-rendered table. One implementation for every admin list page.
 * Sorting is URL-driven (?sort=&direction=); the parent server component reads
 * those params and orders the query. Rows can link via `rowHref`.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  basePath,
  currentParams,
  sort,
  direction,
  empty,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowHref?: (row: Row) => string;
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty?: { title: string; description?: string };
}) {
  if (rows.length === 0) {
    return <EmptyState title={empty?.title ?? "Nothing here yet"} description={empty?.description} />;
  }

  return (
    <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2.5 font-medium ${col.hideOnMobile ? "hidden sm:table-cell" : ""} ${col.className ?? ""}`}>
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
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-muted/30">
                {columns.map((col) => {
                  const content = col.cell(row);
                  return (
                    <td key={col.key} className={`px-3 py-2.5 align-middle ${col.hideOnMobile ? "hidden sm:table-cell" : ""} ${col.className ?? ""}`}>
                      {href ? (
                        <Link href={href} className="block">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
