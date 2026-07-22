import { Package, CheckCircle2, Layers } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listProductsAdmin, getCatalogueKpis } from "@/server/modules/commerce/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { resolveTableRows } from "@/components/admin/resolveTableRows";
import { CatalogueTabs } from "@/components/admin/CatalogueTabs";
import { CreateProductDialog } from "@/components/admin/ProductDialogs";
import type { ProductRow } from "@/server/modules/commerce/admin";

export const dynamic = "force-dynamic";

export default async function CataloguePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listProductsAdmin(ctx, q),
    getCatalogueKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Product",
      sortKey: "name",
      cell: (p) => (
        <div>
          <div className="font-medium text-foreground">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.brandName}</div>
        </div>
      ),
    },
    { key: "sku", header: "SKU", sortKey: "sku", hideOnMobile: true, cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.sku}</span> },
    { key: "variants", header: "Variants", hideOnMobile: true, cell: (p) => <span className="tabular-nums">{p.variantCount}</span> },
    { key: "price", header: "From", cell: (p) => <span className="tabular-nums">{p.priceFromCents != null ? formatCents(p.priceFromCents) : "—"}</span> },
    { key: "active", header: "Status", cell: (p) => <StatusBadge status={p.active ? "active" : "inactive"} /> },
  ];

  return (
    <div>
      <PageHeader title="Catalogue" description="Every product and variant across all brands. Commerce is Kick-controlled." />

      <CatalogueTabs />

      <div className="mb-4 flex justify-end">
        <CreateProductDialog brandOptions={brandOptions} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPIStatCard label="Products" value={kpis.products} icon={Package} tone="info" />
        <KPIStatCard label="Active" value={kpis.activeProducts} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Variants" value={kpis.variants} icon={Layers} tone="purple" />
      </div>

      <ListToolbar
        searchPlaceholder="Search products by name or SKU…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
        ]}
      />

      <DataTable
        {...resolveTableRows(columns, rows, (p) => p.id)}
        basePath="/admin/commerce"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No products found", description: q.search || q.brand ? "Try different filters." : "Products appear here once brands add catalogue items." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} product{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/commerce", q.raw, { page: p })} />
      </div>
    </div>
  );
}
