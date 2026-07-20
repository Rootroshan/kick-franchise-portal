import { Plus, Building2, CheckCircle2, Store, Users2, ShoppingCart, DollarSign } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listBrands, getBrandKpis } from "@/server/modules/tenants/brands";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, EmptyState, Pagination, PrimaryButtonLink } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { BrandsList } from "@/components/admin/BrandsList";

export const dynamic = "force-dynamic";

export default async function BrandsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis] = await Promise.all([listBrands(ctx, q), getBrandKpis(ctx)]);
  const pages = pageCount(total, q.limit);

  // Domain status lives on a related table, so it is filtered after the query
  // rather than pushed into it — a page holds at most 100 rows, and this keeps
  // the shared list query untouched.
  const domainFilter = typeof searchParams.domain === "string" ? searchParams.domain : "";
  const visible = domainFilter
    ? rows.filter((b) => (domainFilter === "none" ? b.customDomain === null : b.domainStatus === domainFilter))
    : rows;

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Every franchise brand on the platform. Open a brand to manage its stores, members, and domains."
        action={
          <PrimaryButtonLink href="/admin/brands/new">
            <Plus className="h-4 w-4" /> New Brand
          </PrimaryButtonLink>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KPIStatCard label="Total Brands" value={kpis.totalBrands} icon={Building2} tone="info" />
        <KPIStatCard label="Active Brands" value={kpis.activeBrands} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Total Stores" value={kpis.totalStores} icon={Store} tone="purple" />
        <KPIStatCard label="Total Members" value={kpis.totalMembers} icon={Users2} tone="info" />
        <KPIStatCard label="Total Orders" value={kpis.totalOrders} icon={ShoppingCart} tone="warning" />
        <KPIStatCard label="Platform Revenue" value={formatCents(kpis.totalRevenueCents)} icon={DollarSign} tone="teal" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by brand name, slug or custom domain…"
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
          {
            key: "domain",
            label: "Domain",
            options: [
              { value: "VERIFIED", label: "Verified" },
              { value: "PENDING", label: "Pending DNS" },
              { value: "FAILED", label: "Failed" },
              { value: "none", label: "No custom domain" },
            ],
          },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="No brands found"
          description={
            q.search || q.status || domainFilter ? "Try different filters." : "Create your first brand to get started."
          }
          icon={Building2}
        />
      ) : (
        <BrandsList rows={visible} />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs font-medium text-foreground/70">
          Showing {visible.length} of {total} brand{total === 1 ? "" : "s"}
        </p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/brands", q.raw, { page: p })} />
      </div>
    </div>
  );
}
