import { requireRole } from "@/server/modules/identity/guard";
import { getFranchisorDashboard } from "@/server/modules/franchisor-dashboard/service";
import { PageHeader } from "@/components/admin/kit";
import { DateRangeFilter } from "@/components/franchisor/dashboard/DateRangeFilter";
import { TrendIndicator } from "@/components/franchisor/dashboard/TrendIndicator";

export const dynamic = "force-dynamic";

export default async function FranchisorAnalyticsPage({ searchParams }: { searchParams: { preset?: string; from?: string; to?: string } }) {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const data = await getFranchisorDashboard(ctx, searchParams);

  return (
    <div>
      <PageHeader title="Engagement Analytics" description="How your stores engage with brand communication and operations." action={<DateRangeFilter />} />

      <div className="mb-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-1 text-sm text-muted-foreground">Overall Engagement ({data.rangeLabel})</div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold tabular-nums">{data.engagement.overall}%</span>
          <TrendIndicator trend={data.engagement.overallTrend} label="vs last period" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.engagement.components.map((c) => (
          <div key={c.key} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{c.available ? `${c.percent}%` : "—"}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.available ? c.percent : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Top Performing Stores</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {data.topStores.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No store engagement data yet.</p>
        ) : (
          data.topStores.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
              <span className="w-5 text-center font-semibold text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-status-success" style={{ width: `${s.score}%` }} />
              </div>
              <span className="w-12 text-right text-sm font-semibold tabular-nums">{s.score}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
