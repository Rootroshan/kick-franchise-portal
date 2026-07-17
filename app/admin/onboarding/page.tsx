import { ListChecks, FileStack, Percent } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listOnboardingAdmin, getOnboardingKpis } from "@/server/modules/onboarding/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { OnboardingRow } from "@/server/modules/onboarding/admin";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listOnboardingAdmin(ctx, q),
    getOnboardingKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<OnboardingRow>[] = [
    {
      key: "name",
      header: "Template",
      sortKey: "name",
      cell: (t) => (
        <div>
          <div className="font-medium text-foreground">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.brandName}</div>
        </div>
      ),
    },
    { key: "items", header: "Steps", hideOnMobile: true, cell: (t) => <span className="tabular-nums">{t.itemCount}</span> },
    { key: "stores", header: "Stores", hideOnMobile: true, cell: (t) => <span className="tabular-nums">{t.storeCount}</span> },
    {
      key: "completion",
      header: "Completion",
      cell: (t) => {
        const pct = t.totalCheckpoints === 0 ? 0 : Math.round((t.completedItems / t.totalCheckpoints) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${pct === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Onboarding" description="Onboarding templates across all brands, with per-store completion progress." />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPIStatCard label="Templates" value={kpis.templates} icon={FileStack} tone="info" />
        <KPIStatCard label="Total Steps" value={kpis.items} icon={ListChecks} tone="purple" />
        <KPIStatCard label="Avg Completion" value={`${kpis.avgCompletionPct}%`} icon={Percent} tone="success" />
      </div>

      <ListToolbar searchPlaceholder="Search templates…" filters={[{ key: "brand", label: "Brand", options: brandOptions }]} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        rowHref={(t) => `/admin/onboarding/${t.id}`}
        basePath="/admin/onboarding"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No templates found", description: q.search || q.brand ? "Try different filters." : "Onboarding templates from all brands appear here." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} template{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/onboarding", q.raw, { page: p })} />
      </div>
    </div>
  );
}
