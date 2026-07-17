import Link from "next/link";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/server/modules/dashboard/service";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function statusTone(status: string): "default" | "secondary" | "destructive" {
  if (status === "PAID" || status === "FULFILLED") return "default";
  if (status === "FAILED" || status === "CANCELLED") return "destructive";
  return "secondary";
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { kpis } = data;
  const allowancePct =
    kpis.allowanceGrantedCents > 0 ? Math.round((kpis.allowanceUsedCents / kpis.allowanceGrantedCents) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview across all brands — {data.periodLabel}</p>
        </div>
        <Link
          href="/admin/tenants"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Manage brands
        </Link>
      </div>

      {/* Money-first KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sales (this quarter)" value={formatCents(kpis.salesCents)} sub={`${kpis.orderCount} paid orders`} />
        <Kpi label="Rebates accrued" value={formatCents(kpis.rebateCents)} sub="billable to franchisors" />
        <Kpi
          label="Allowance used"
          value={formatCents(kpis.allowanceUsedCents)}
          sub={`of ${formatCents(kpis.allowanceGrantedCents)} granted · ${allowancePct}%`}
        />
        <Kpi label="Brands / stores" value={`${kpis.tenantCount} / ${kpis.storeCount}`} sub="tenants and locations" />
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="mb-2 text-sm font-semibold text-destructive">Needs attention</div>
          <ul className="flex flex-col gap-1.5">
            {data.alerts.map((a) => (
              <li key={a.kind} className="flex items-center gap-2 text-sm">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                  {a.count}
                </span>
                <span className="text-foreground">{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Brands */}
        <div className="lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Brands</h2>
            <Link href="/admin/tenants" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {data.brands.length === 0 && <div className="p-4 text-sm text-muted-foreground">No brands yet.</div>}
            {data.brands.map((b) => (
              <Link key={b.id} href={`/admin/tenants/${b.id}`} className="flex items-center justify-between p-3 hover:bg-muted">
                <div>
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.storeCount} {b.storeCount === 1 ? "store" : "stores"} · {b.orderCount} orders
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatCents(b.salesCents)}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">When</th>
                  <th className="p-3 font-medium">Brand · Store</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Total</th>
                  <th className="hidden p-3 text-right font-medium sm:table-cell">Allowance / Card</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No orders yet.
                    </td>
                  </tr>
                )}
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                    <td className="p-3">
                      <div className="font-medium">{o.tenantName}</div>
                      <div className="text-xs text-muted-foreground">{o.storeName}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">{formatCents(o.subtotalCents)}</td>
                    <td className="hidden p-3 text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                      {formatCents(o.allowanceAppliedCents)} / {formatCents(o.cardChargedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
