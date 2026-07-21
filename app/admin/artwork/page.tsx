import { Images, CheckCircle2, Archive, HardDrive, Info } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAssetsAdmin, getAssetKpis, getAssetTypeOptions } from "@/server/modules/assets/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatBytes } from "@/lib/utils";
import { PageHeader, KPIStatCard, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { ArtworkListSection } from "@/components/admin/artwork/ArtworkListSection";

export const dynamic = "force-dynamic";

export default async function ArtworkPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions, typeOptions] = await Promise.all([
    listAssetsAdmin(ctx, q),
    getAssetKpis(ctx),
    getBrandFilterOptions(ctx),
    getAssetTypeOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  return (
    <div>
      <PageHeader title="Artwork Hub" description="Brand assets managed centrally by Kick — logos, signage, menu boards, campaign artwork." />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 px-3 py-2 text-sm text-status-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Artwork is uploaded and versioned by Kick only. Franchisors and franchisees can download active assets but cannot upload.</span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Assets" value={kpis.total} icon={Images} tone="info" />
        <KPIStatCard label="Active" value={kpis.active} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Archived" value={kpis.archived} icon={Archive} tone="warning" />
        <KPIStatCard label="Storage Used" value={formatBytes(kpis.totalBytes)} icon={HardDrive} tone="purple" />
      </div>

      <ListToolbar
        searchPlaceholder="Search artwork by name or category…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          { key: "type", label: "Type", options: typeOptions },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "ARCHIVED", label: "Archived" },
              { value: "DEPRECATED", label: "Deprecated" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand || q.status ? "No artwork matches your filters." : "Assets uploaded by Kick appear here."}
        </div>
      ) : (
        <ArtworkListSection rows={rows} total={total} />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} asset{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/artwork", q.raw, { page: p })} />
      </div>
    </div>
  );
}
