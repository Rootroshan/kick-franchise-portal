import { Plus, Building2, CheckCircle2, Store, DollarSign } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listBrands, getBrandKpis } from "@/server/modules/tenants/brands";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination, PrimaryButtonLink } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { BrandRow } from "@/server/modules/tenants/brands";

export const dynamic = "force-dynamic";

export default async function BrandsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis] = await Promise.all([listBrands(ctx, q), getBrandKpis(ctx)]);
  const pages = pageCount(total, q.limit);

  const columns: Column<BrandRow>[] = [
    {
      key: "name",
      header: "Brand",
      sortKey: "name",
      cell: (b) => (
        <div>
          <div className="font-medium text-foreground">{b.name}</div>
          <div className="text-xs text-muted-foreground">{b.slug}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", cell: (b) => <StatusBadge status={b.status} /> },
    { key: "stores", header: "Stores", hideOnMobile: true, cell: (b) => <span className="tabular-nums">{b.storeCount}</span> },
    { key: "members", header: "Members", hideOnMobile: true, cell: (b) => <span className="tabular-nums">{b.memberCount}</span> },
    { key: "orders", header: "Orders", hideOnMobile: true, cell: (b) => <span className="tabular-nums">{b.orderCount}</span> },
    { key: "revenue", header: "Revenue", cell: (b) => <span className="font-medium tabular-nums">{formatCents(b.revenueCents)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Every franchise brand on the platform. Click a brand to manage its stores, members, and domains."
        action={
          <PrimaryButtonLink href="/admin/brands/new">
            <Plus className="h-4 w-4" /> New Brand
          </PrimaryButtonLink>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Brands" value={kpis.totalBrands} icon={Building2} tone="info" />
        <KPIStatCard label="Active" value={kpis.activeBrands} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Total Stores" value={kpis.totalStores} icon={Store} tone="purple" />
        <KPIStatCard label="Platform Revenue" value={formatCents(kpis.totalRevenueCents)} icon={DollarSign} tone="teal" />
      </div>

      <ListToolbar
        searchPlaceholder="Search brands by name or slug…"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(b) => b.id}
        rowHref={(b) => `/admin/brands/${b.slug}`}
        basePath="/admin/brands"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No brands found", description: q.search ? "Try a different search." : "Create your first brand to get started." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} brand{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/brands", q.raw, { page: p })} />
      </div>
    </div>
  );
}
