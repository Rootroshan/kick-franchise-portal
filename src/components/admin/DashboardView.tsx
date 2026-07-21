import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Building2,
  Store,
  ShoppingCart,
  Lock,
  DollarSign,
  Package,
  Tag,
  Boxes,
  CreditCard,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { QuickActions } from "@/components/admin/QuickActions";
import type { DashboardData } from "@/server/modules/dashboard/service";

// Charts are client-only + heavy → dynamic import (spec §23).
const RevenueBarChart = dynamic(() => import("@/components/charts/RevenueBarChart").then((m) => m.RevenueBarChart), {
  loading: () => <div className="h-48 animate-pulse rounded bg-muted" />,
});
const OrdersDonut = dynamic(() => import("@/components/charts/OrdersDonut").then((m) => m.OrdersDonut), {
  loading: () => <div className="h-40 animate-pulse rounded bg-muted" />,
});

const KPI_ICON: Record<string, typeof Building2> = {
  brands: Building2,
  stores: Store,
  orders: ShoppingCart,
  allowance: Lock,
  rebate: Tag,
  revenue: DollarSign,
};

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">new</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-status-success" : "text-status-error"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% <span className="font-normal text-muted-foreground">vs last month</span>
    </span>
  );
}

function statusTone(status: string): "default" | "secondary" | "destructive" {
  if (status === "PAID" || status === "FULFILLED") return "default";
  if (status === "FAILED" || status === "CANCELLED") return "destructive";
  return "secondary";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}>{children}</div>;
}

function SectionTitle({ title, sub, href, hrefLabel }: { title: string; sub?: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-xs font-medium text-status-info hover:underline">
          {hrefLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const ar = data.allowanceRebate;
  const allowancePct = ar.allowanceGrantedCents > 0 ? Math.round((ar.allowanceUsedCents / ar.allowanceGrantedCents) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ---- KPI ROW ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((k) => {
          const Icon = KPI_ICON[k.key] ?? DollarSign;
          return (
            <Card key={k.key}>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-status-info" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</span>
              </div>
              <div className="text-xl font-bold tabular-nums">{k.isMoney ? formatCents(k.value) : k.value.toLocaleString()}</div>
              <div className="mt-1">{k.changePct !== null ? <Change pct={k.changePct} /> : <span className="text-xs text-muted-foreground">{k.sub}</span>}</div>
            </Card>
          );
        })}
      </div>

      {/* ---- ALERTS ---- */}
      {data.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-status-warning/40 bg-status-warning/5 p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-status-warning">
            <AlertTriangle className="h-4 w-4" /> Needs attention
          </span>
          {data.alerts.map((a) => (
            <span key={a.kind} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-bold text-white">{a.count}</span>
              {a.label}
            </span>
          ))}
        </div>
      )}

      {/* ---- BRAND OVERVIEW (horizontal scroll) ---- */}
      <section>
        <SectionTitle title="Brand Overview" sub="All brands with key metrics and quick access." href="/admin/tenants" hrefLabel="View all brands" />
        <div className="flex gap-3 scrollbar-hide overflow-x-auto pb-2">
          {data.brands.length === 0 && <Card className="text-sm text-muted-foreground">No brands yet.</Card>}
          {data.brands.map((b) => (
            <Card key={b.id} className="w-56 shrink-0">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                    {b.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold leading-tight">{b.name}</span>
                </div>
                <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
              </div>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Active stores</dt><dd className="font-medium tabular-nums">{b.storeCount}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Monthly orders</dt><dd className="font-medium tabular-nums">{b.orderCount}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Monthly revenue</dt><dd className="font-medium tabular-nums">{formatCents(b.salesCents)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Allowance used</dt><dd className="font-medium tabular-nums">{formatCents(b.allowanceUsedCents)}</dd></div>
              </dl>
              <Link href={`/admin/tenants/${b.id}`} className="mt-3 block rounded-md border border-border py-1.5 text-center text-xs font-medium hover:bg-muted">
                View brand
              </Link>
            </Card>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          <span>Total active stores: <b className="text-foreground tabular-nums">{data.totals.activeStores}</b></span>
          <span>Franchisors: <b className="text-foreground tabular-nums">{data.totals.franchisors}</b></span>
          <span>Total users: <b className="text-foreground tabular-nums">{data.totals.users}</b></span>
          <span>Kick admins: <b className="text-foreground tabular-nums">{data.totals.kickAdmins}</b></span>
        </div>
      </section>

      {/* ---- COMMERCE CONTROL CENTER ---- */}
      <section>
        <SectionTitle title="Commerce Control Center" sub="Core commerce, pricing, inventory and fulfilment across the platform." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <CommerceCard icon={Package} label="Product Catalogue" value={data.commerce.productCount.toLocaleString()} unit="products" href="/admin/commerce" cta="View catalogue" />
          <CommerceCard icon={Tag} label="Pricing Rules" value={data.commerce.pricingRuleCount.toLocaleString()} unit="active rules" href="/admin/ordering-rules" cta="View rules" />
          <CommerceCard icon={Boxes} label="Stock Visibility" value={data.commerce.trackedStock.toLocaleString()} unit="tracked units" href="/admin/commerce" cta="View stock" />
          <CommerceCard icon={CreditCard} label="Payment Flow" value={formatCents(data.commerce.cardVolumeCents)} unit="card volume (mo)" href="/admin/orders" cta="View payments" />
          <CommerceCard icon={Truck} label="Fulfilment" value={data.commerce.pendingFulfilment.toLocaleString()} unit="orders pending" href="/admin/orders" cta="View fulfilment" />
        </div>
      </section>

      {/* ---- ALLOWANCE/REBATE + SALES ANALYTICS ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Allowance & Rebate Snapshot" sub={`Usage across all brands · ${data.periodLabel}`} href="/admin/allowances" hrefLabel="View details" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Metric</th>
                <th className="pb-2 text-right font-medium">Used / Allocated</th>
                <th className="pb-2 text-right font-medium">Used %</th>
                <th className="pb-2 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-border">
                <td className="py-2 font-medium">Allowances</td>
                <td className="py-2 text-right">{formatCents(ar.allowanceUsedCents)} / {formatCents(ar.allowanceGrantedCents)}</td>
                <td className="py-2 text-right">{allowancePct}%</td>
                <td className="py-2 text-right text-status-success">{formatCents(ar.allowanceRemainingCents)}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Rebates accrued</td>
                <td className="py-2 text-right">{formatCents(ar.rebateAccruedCents)}</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right text-muted-foreground">billable</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Allowance usage</span>
              <span>{allowancePct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-status-teal" style={{ width: `${Math.min(allowancePct, 100)}%` }} />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Sales Analytics" sub="Revenue over the last 6 months, and orders by status." />
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums">{formatCents(data.sales.monthlyRevenueCents)}</span>
            <span className="text-xs text-muted-foreground">this month</span>
          </div>
          <RevenueBarChart data={data.sales.series} />
          <div className="mt-4 border-t border-border pt-4">
            <OrdersDonut data={data.ordersByStatus} />
          </div>
        </Card>
      </div>

      {/* ---- RECENT ORDERS + ACTIVITY + QUICK ACTIONS ---- */}
      {/* min-w-0 on the grid item: without it a grid item defaults to
          min-width:auto, so the table's min-w-[560px] pushed this Card (and
          the grid track containing it) wider than the row instead of
          scrolling inside its own overflow-x-auto wrapper. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <SectionTitle title="Recent Orders" sub="Latest order placements across all brands." href="/admin/orders" />
          <div className="-mx-4 scrollbar-hide overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Brand · Store</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Allowance / Card</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No orders yet.</td></tr>
                )}
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-2"><div className="font-medium">{o.tenantName}</div><div className="text-xs text-muted-foreground">{o.storeName}</div></td>
                    <td className="px-4 py-2"><Badge variant={statusTone(o.status)}>{o.status}</Badge></td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatCents(o.subtotalCents)}</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{formatCents(o.allowanceAppliedCents)} / {formatCents(o.cardChargedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Activity and Platform Health were removed by request —
            audit detail lives at /admin/audit-log, service health at
            /admin/settings. Quick Actions keeps the right-hand column. */}
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Quick Actions" sub="Shortcuts to common admin functions." />
            <QuickActions />
          </Card>
        </div>
      </div>
    </div>
  );
}

function CommerceCard({
  icon: Icon,
  label,
  value,
  unit,
  href,
  cta,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  unit: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-status-info" />
      </div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{unit}</div>
      <Link href={href} className="mt-2 block rounded-md border border-border py-1.5 text-center text-xs font-medium hover:bg-muted">
        {cta}
      </Link>
    </div>
  );
}
