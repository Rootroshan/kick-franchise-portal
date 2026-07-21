import { WalletCards, TrendingDown, PiggyBank, Layers } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAllowancesAdmin, getAllowanceKpis } from "@/server/modules/allowances/listView";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTableSection } from "@/components/admin/DataTableSection";
import { allowancesExportAction } from "@/components/admin/allowances/AllowancesExportAction";
import type { AllowanceRow } from "@/server/modules/allowances/listView";

export const dynamic = "force-dynamic";

export default async function AllowancesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listAllowancesAdmin(ctx, q),
    getAllowanceKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns = [
    {
      key: "store",
      header: "Store",
      cell: (a: AllowanceRow) => (
        <div>
          <div className="font-medium text-foreground">{a.storeName}</div>
          <div className="text-xs text-muted-foreground">{a.brandName}</div>
        </div>
      ),
    },
    { key: "period", header: "Period", sortKey: "period", cell: (a: AllowanceRow) => <span className="text-muted-foreground">{a.periodLabel}</span> },
    { key: "granted", header: "Granted", hideOnMobile: true, cell: (a: AllowanceRow) => <span className="tabular-nums">{formatCents(a.grantedCents)}</span> },
    { key: "used", header: "Used", hideOnMobile: true, cell: (a: AllowanceRow) => <span className="tabular-nums text-muted-foreground">{formatCents(a.usedCents)}</span> },
    {
      key: "balance",
      header: "Balance",
      cell: (a: AllowanceRow) => <span className={`font-medium tabular-nums ${a.balanceCents <= 0 ? "text-status-error" : "text-status-success"}`}>{formatCents(a.balanceCents)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Allowances" description="Per-store spending allowances across all brands, with computed balances from the append-only ledger." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Allowances" value={kpis.count} icon={Layers} tone="info" />
        <KPIStatCard label="Granted" value={formatCents(kpis.grantedCents)} icon={WalletCards} tone="purple" />
        <KPIStatCard label="Used" value={formatCents(kpis.usedCents)} icon={TrendingDown} tone="warning" />
        <KPIStatCard label="Balance" value={formatCents(kpis.balanceCents)} icon={PiggyBank} tone="success" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by store or period…"
        filters={[{ key: "brand", label: "Brand", options: brandOptions }]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand ? "No allowances match your filters." : "Grant allowances to stores to see them here."}
        </div>
      ) : (
        <DataTableSection
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          rowHref={(a) => `/admin/allowances/${a.id}`}
          basePath="/admin/allowances"
          currentParams={q.raw}
          sort={q.sort}
          direction={q.direction}
          empty={{ title: "No allowances found", description: q.search || q.brand ? "Try different filters." : "Grant allowances to stores to see them here." }}
          actions={[allowancesExportAction]}
          itemName="allowance"
          total={total}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} allowance{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/allowances", q.raw, { page: p })} />
      </div>
    </div>
  );
}
