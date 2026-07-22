import Link from "next/link";
import { Package, PackageOpen, ShoppingCart, Truck, CircleCheckBig, XCircle, LifeBuoy, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import {
  listStoreOrders,
  getStoreOrderSummary,
  getRecentOrderActivity,
  type StoreOrderListQuery,
} from "@/server/modules/commerce/storeOrders";
import { isDisplayStatus } from "@/lib/orderStatus";
import { cn, formatDateTime } from "@/lib/utils";
import { OrdersToolbar } from "@/components/franchisee/orders/OrdersToolbar";
import { OrderCard } from "@/components/franchisee/orders/OrderCard";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "All Orders" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function parseDate(v: string | undefined, endOfDay = false): Date | undefined {
  if (!v) return undefined;
  const d = new Date(endOfDay ? `${v}T23:59:59.999` : `${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function OrdersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  const query: StoreOrderListQuery = {
    status: searchParams.status && isDisplayStatus(searchParams.status) ? searchParams.status : undefined,
    q: searchParams.q,
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to, true),
    sort: (["newest", "oldest", "total_desc", "total_asc"] as const).find((s) => s === searchParams.sort),
    page: Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1),
    pageSize: 10,
  };

  // Independent queries in parallel — list, summary cards, activity rail, brand name.
  const [list, summary, activity, brand] = await Promise.all([
    listStoreOrders(ctx, query),
    getStoreOrderSummary(ctx),
    getRecentOrderActivity(ctx),
    withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: ctx.tenantId! }, select: { name: true, email: true } })),
  ]);

  const brandName = brand?.name ?? "Store";
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasAnyOrders = summary.total > 0;
  const activeTab = query.status ?? null;

  const withParams = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) next.set(k, v);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  const SUMMARY_CARDS = [
    { key: null, label: "Total Orders", sub: "All time", count: summary.total, icon: Package, tone: "text-primary bg-primary/10" },
    { key: "processing", label: "Processing", sub: "Being prepared", count: summary.processing, icon: PackageOpen, tone: "text-status-info bg-status-info/10" },
    { key: "shipped", label: "Shipped", sub: "On the way", count: summary.shipped, icon: Truck, tone: "text-status-warning bg-status-warning/10" },
    { key: "delivered", label: "Delivered", sub: "Successfully received", count: summary.delivered, icon: CircleCheckBig, tone: "text-status-success bg-status-success/10" },
    { key: "cancelled", label: "Cancelled", sub: "Not completed", count: summary.cancelled, icon: XCircle, tone: "text-status-error bg-status-error/10" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Order History</h1>
        <p className="text-sm text-muted-foreground">View and track all orders placed by your store.</p>
      </div>

      {/* Summary cards — each filters the list. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {SUMMARY_CARDS.map(({ key, label, sub, count, icon: Icon, tone }) => (
          <Link
            key={label}
            href={withParams({ status: key, page: null })}
            aria-label={`${label}: ${count}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40",
              activeTab === key ? "border-primary" : "border-border"
            )}
          >
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
              <span className="block text-lg font-bold tabular-nums">{count}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Filter orders by status">
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              href={withParams({ status: tab.key, page: null })}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <OrdersToolbar />

          {list.rows.length === 0 ? (
            hasAnyOrders ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
                <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">No matching orders</p>
                <p className="text-sm text-muted-foreground">Try a different search, status or date range.</p>
                <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-14 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <PackageOpen className="h-10 w-10 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold">No orders yet</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  You haven&apos;t placed any orders for your store yet. Browse approved products to get started.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Start Shopping
                </Link>
              </div>
            )
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {list.rows.map((order) => (
                  <OrderCard key={order.id} order={order} brandName={brandName} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="flex items-center justify-between" aria-label="Order pages">
                  <PageLink href={withParams({ page: String(list.page - 1) })} disabled={list.page <= 1}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                  </PageLink>
                  <span className="text-xs text-muted-foreground">
                    Page {list.page} of {totalPages} · {list.total} orders
                  </span>
                  <PageLink href={withParams({ page: String(list.page + 1) })} disabled={list.page >= totalPages}>
                    Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </PageLink>
                </nav>
              )}
            </>
          )}
        </div>

        {/* Right rail (stacks below the list on small screens) */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Recent activity">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity. Your order activity will appear here once you place an order.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {activity.map((event) => (
                  <li key={event.id}>
                    <Link href={`/orders/${event.orderId}`} className="group block">
                      <p className="text-sm group-hover:text-primary">
                        {event.label} · <span className="font-medium">#{event.orderNumber}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Support card only when the brand has a real contact email — never a dead button. */}
          {brand?.email && (
            <section className="rounded-xl border border-border bg-card p-4" aria-label="Support">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Need help with your order?
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">Contact your brand support team for any order-related questions.</p>
              <a
                href={`mailto:${brand.email}`}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-primary/40 text-sm font-medium text-primary hover:bg-primary/5"
              >
                Contact Support
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
      {children}
    </Link>
  );
}
