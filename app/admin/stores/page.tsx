import { Store, CheckCircle2, ShoppingCart, DollarSign } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listStores, getStoreKpis, getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTableSection } from "@/components/admin/DataTableSection";
import type { StoreRow } from "@/server/modules/tenants/stores";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkActivateStoresAction, bulkDeactivateStoresAction } from "./storeActions";
import { Power, PowerOff } from "lucide-react";

export const dynamic = "force-dynamic";

const STORE_ACTIONS: BulkActionDef[] = [
  {
    key: "activate",
    label: "Activate",
    icon: Power,
    tone: "success",
    action: bulkActivateStoresAction,
  },
  {
    key: "deactivate",
    label: "Deactivate",
    icon: PowerOff,
    tone: "warning",
    action: bulkDeactivateStoresAction,
  },
];

export default async function StoresPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listStores(ctx, q),
    getStoreKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns = [
    {
      key: "name",
      header: "Store",
      sortKey: "name",
      cell: (s: StoreRow) => (
        <div>
          <div className="font-medium text-foreground">{s.name}</div>
          <div className="text-xs text-muted-foreground">{s.address ?? "No address"}</div>
        </div>
      ),
    },
    { key: "brand", header: "Brand", cell: (s: StoreRow) => <span className="text-muted-foreground">{s.brandName}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (s: StoreRow) => <StatusBadge status={s.status} /> },
    { key: "members", header: "Members", hideOnMobile: true, cell: (s: StoreRow) => <span className="tabular-nums">{s.memberCount}</span> },
    { key: "orders", header: "Orders", hideOnMobile: true, cell: (s: StoreRow) => <span className="tabular-nums">{s.orderCount}</span> },
    { key: "revenue", header: "Revenue", cell: (s: StoreRow) => <span className="font-medium tabular-nums">{formatCents(s.revenueCents)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Stores" description="Every store location across all brands. Click a store to see its team and orders." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Stores" value={kpis.totalStores} icon={Store} tone="info" />
        <KPIStatCard label="Active" value={kpis.activeStores} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Total Orders" value={kpis.totalOrders} icon={ShoppingCart} tone="warning" />
        <KPIStatCard label="Revenue" value={formatCents(kpis.totalRevenueCents)} icon={DollarSign} tone="teal" />
      </div>

      <ListToolbar
        searchPlaceholder="Search stores by name…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand ? "No stores match your filters." : "Stores appear here once brands add locations."}
        </div>
      ) : (
        <DataTableSection
          rows={rows}
          columns={columns}
          rowKey={(s) => s.id}
          rowHref={(s) => `/admin/stores/${s.id}`}
          basePath="/admin/stores"
          currentParams={q.raw}
          sort={q.sort}
          direction={q.direction}
          empty={{ title: "No stores found", description: q.search || q.brand ? "Try different filters." : "Stores appear here once brands add locations." }}
          actions={STORE_ACTIONS}
          itemName="store"
          total={total}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} store{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/stores", q.raw, { page: p })} />
      </div>
    </div>
  );
}
