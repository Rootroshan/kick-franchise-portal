import type { Column } from "@/components/admin/DataTable";
import { resolveTableRows } from "@/components/admin/resolveTableRows";
import type { AuditRow } from "@/server/modules/identity/auditList";
import { AuditLogListSectionClient } from "./AuditLogListSectionClient";

type Props = {
  rows: AuditRow[];
  total: number;
  columns: Column<AuditRow>[];
  basePath: string;
  currentParams: Record<string, string>;
  sort?: string;
  direction?: "asc" | "desc";
  empty: { title: string; description?: string };
};

/**
 * Server Component. Resolves each row's `cell` callbacks into plain data here
 * — functions can't be passed from a Server Component into the "use client"
 * table below, only serializable data can.
 */
export function AuditLogListSection({ rows, total, columns, basePath, currentParams, sort, direction, empty }: Props) {
  const { columns: headers, rows: resolvedRows } = resolveTableRows(columns, rows, (l) => l.id);

  return (
    <AuditLogListSectionClient
      headers={headers}
      rows={resolvedRows}
      total={total}
      basePath={basePath}
      currentParams={currentParams}
      sort={sort}
      direction={direction}
      empty={empty}
    />
  );
}
