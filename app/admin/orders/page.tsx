import { ShoppingCart, CheckCircle2, RotateCcw, DollarSign } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listOrdersAdmin, getOrderKpis } from "@/server/modules/commerce/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTableSection } from "@/components/admin/DataTableSection";
import type { OrderRow } from "@/server/modules/commerce/admin";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkCancelOrdersAction } from "./orderActions";
import { XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const ORDER_ACTIONS: BulkActionDef[] = [
  {
    key: "cancel",
    label: "Cancel",
    icon: XCircle,
    tone: "destructive",
    confirmTitle: "Cancel selected orders?",
    confirmMessage: "Only pending and paid orders can be cancelled. Already fulfilled or refunded orders cannot be cancelled in bulk.",
    action: bulkCancelOrdersAction,
  },
];

export default async function OrdersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listOrdersAdmin(ctx, q),
    getOrderKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns = [
    { key: "id", header: "Order", cell: (o: OrderRow) => <span className="font-mono text-xs">{o.id.slice(0, 8)}</span> },
    {
      key: "store",
      header: "Store",
      cell: (o: OrderRow) => (
        <div>
          <div className="text-sm text-foreground">{o.storeName}</div>
          <div className="text-xs text-muted-foreground">{o.brandName}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", cell: (o: OrderRow) => <StatusBadge status={o.status} /> },
    { key: "allowance", header: "Allowance", hideOnMobile: true, cell: (o: OrderRow) => <span className="tabular-nums text-muted-foreground">{formatCents(o.allowanceAppliedCents)}</span> },
    { key: "card", header: "Card", hideOnMobile: true, cell: (o: OrderRow) => <span className="tabular-nums text-muted-foreground">{formatCents(o.cardChargedCents)}</span> },
    { key: "total", header: "Total", sortKey: "total", cell: (o: OrderRow) => <span className="font-medium tabular-nums">{formatCents(o.subtotalCents)}</span> },
    { key: "date", header: "Date", hideOnMobile: true, cell: (o: OrderRow) => <span className="text-muted-foreground">{o.createdAt.toLocaleDateString()}</span> },
  ];

  return (
    <div>
      <PageHeader title="Orders" description="All orders across every brand and store. Click an order to view lines and issue refunds." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Orders" value={kpis.total} icon={ShoppingCart} tone="info" />
        <KPIStatCard label="Paid" value={kpis.paid} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Refunded" value={kpis.refunded} icon={RotateCcw} tone="purple" />
        <KPIStatCard label="Net Revenue" value={formatCents(kpis.revenueCents)} icon={DollarSign} tone="teal" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by order ID…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "PAID", label: "Paid" },
              { value: "FULFILLED", label: "Fulfilled" },
              { value: "REFUNDED", label: "Refunded" },
              { value: "PARTIALLY_REFUNDED", label: "Partially Refunded" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "FAILED", label: "Failed" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand || q.status ? "No orders match your filters." : "Orders appear here as stores check out."}
        </div>
      ) : (
        <DataTableSection
          rows={rows}
          columns={columns}
          rowKey={(o) => o.id}
          rowHref={(o) => `/admin/orders/${o.id}`}
          basePath="/admin/orders"
          currentParams={q.raw}
          sort={q.sort}
          direction={q.direction}
          empty={{ title: "No orders found", description: q.search || q.brand || q.status ? "Try different filters." : "Orders appear here as stores check out." }}
          actions={ORDER_ACTIONS}
          itemName="order"
          total={total}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} order{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/orders", q.raw, { page: p })} />
      </div>
    </div>
  );
}
