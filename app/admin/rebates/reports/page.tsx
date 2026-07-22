import { FileChartColumn, DollarSign, Coins, Download } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listReportsAdmin, getReportKpis } from "@/server/modules/rebates/reportsAdmin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { resolveTableRows } from "@/components/admin/resolveTableRows";
import type { ReportRow } from "@/server/modules/rebates/reportsAdmin";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listReportsAdmin(ctx, q),
    getReportKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<ReportRow>[] = [
    {
      key: "period",
      header: "Period",
      cell: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.periodLabel}</div>
          <div className="text-xs text-muted-foreground">{r.brandName}</div>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <StatusBadge status={r.period === "MONTHLY" ? "info" : "scheduled"} /> },
    { key: "sales", header: "Sales", hideOnMobile: true, cell: (r) => <span className="tabular-nums">{formatCents(r.salesTotalCents)}</span> },
    { key: "rebate", header: "Rebate", cell: (r) => <span className="font-medium tabular-nums">{formatCents(r.rebateTotalCents)}</span> },
    { key: "generated", header: "Generated", hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{r.generatedAt.toLocaleDateString()}</span> },
    {
      key: "download",
      header: "Export",
      cell: (r) => (
        <div className="flex gap-1.5">
          {r.hasCsv && (
            <a
              href={`/api/rebates/reports/${r.id}/download?format=csv`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              aria-label="Download CSV"
            >
              <Download className="h-3 w-3" /> CSV
            </a>
          )}
          {r.hasPdf && (
            <a
              href={`/api/rebates/reports/${r.id}/download?format=pdf`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              aria-label="Download PDF"
            >
              <Download className="h-3 w-3" /> PDF
            </a>
          )}
          {!r.hasCsv && !r.hasPdf && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Rebate Reports" description="Generated periodic rebate reports across all brands, exportable as CSV or PDF." />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPIStatCard label="Reports" value={kpis.total} icon={FileChartColumn} tone="info" />
        <KPIStatCard label="Total Sales" value={formatCents(kpis.salesTotalCents)} icon={DollarSign} tone="teal" />
        <KPIStatCard label="Total Rebates" value={formatCents(kpis.rebateTotalCents)} icon={Coins} tone="purple" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by period label…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          { key: "period", label: "Type", options: [{ value: "MONTHLY", label: "Monthly" }, { value: "QUARTERLY", label: "Quarterly" }] },
        ]}
      />

      <DataTable
        {...resolveTableRows(columns, rows, (r) => r.id)}
        basePath="/admin/rebates/reports"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No reports found", description: q.search || q.brand ? "Try different filters." : "Reports are generated monthly and quarterly per brand." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} report{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/rebates/reports", q.raw, { page: p })} />
      </div>
    </div>
  );
}
