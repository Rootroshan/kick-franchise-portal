import { BadgePercent, CheckCircle2, Coins, FileChartColumn } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listRebateRulesAdmin, getRebateKpis, formatRebateValue } from "@/server/modules/rebates/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination, GhostButtonLink } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { RebateRuleRow } from "@/server/modules/rebates/admin";

export const dynamic = "force-dynamic";

export default async function RebatesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listRebateRulesAdmin(ctx, q),
    getRebateKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<RebateRuleRow>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.productName}</div>
          <div className="text-xs text-muted-foreground">{r.brandName}</div>
        </div>
      ),
    },
    { key: "type", header: "Rebate", cell: (r) => <span className="tabular-nums">{formatRebateValue(r.type, r.value)}</span> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge status={r.isActive ? "active" : "expired"} /> },
    {
      key: "effective",
      header: "Effective",
      sortKey: "effectiveFrom",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.effectiveFrom.toLocaleDateString()} → {r.effectiveTo ? r.effectiveTo.toLocaleDateString() : "ongoing"}
        </span>
      ),
    },
    { key: "accrued", header: "Accrued", cell: (r) => <span className="font-medium tabular-nums">{formatCents(r.accruedCents)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Rebates"
        description="Rebate rules across all brands and the amounts accrued against them. Commerce is Kick-controlled."
        action={<GhostButtonLink href="/admin/rebates/reports"><FileChartColumn className="h-4 w-4" /> Reports</GhostButtonLink>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Rules" value={kpis.rules} icon={BadgePercent} tone="info" />
        <KPIStatCard label="Active" value={kpis.activeRules} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Total Accrued" value={formatCents(kpis.accruedCents)} icon={Coins} tone="teal" />
        <KPIStatCard label="Reports" value={kpis.reports} icon={FileChartColumn} tone="purple" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by product…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          { key: "type", label: "Type", options: [{ value: "PERCENT", label: "Percent" }, { value: "FLAT", label: "Flat" }] },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        basePath="/admin/rebates"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No rebate rules found", description: q.search || q.brand ? "Try different filters." : "Rebate rules appear here once configured." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} rule{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/rebates", q.raw, { page: p })} />
      </div>
    </div>
  );
}
