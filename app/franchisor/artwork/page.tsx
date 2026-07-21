import Link from "next/link";
import { Images, FileImage, Upload, Info } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorAssets } from "@/server/modules/assets/franchisorList";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, EmptyState, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { CategoryChips } from "@/components/franchisor/artwork/CategoryChips";
import { FranchisorArtworkListSection } from "@/components/franchisor/artwork/FranchisorArtworkListSection";

export const dynamic = "force-dynamic";

export default async function ArtworkPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const q = parseListQuery(searchParams);
  const { rows, total, categories, totalCount } = await listFranchisorAssets(ctx, ctx.tenantId, q);
  const pages = pageCount(total, q.limit);
  const activeCategory = q.raw.category ?? "all";

  return (
    <div>
      <PageHeader
        title="Artwork Hub"
        description="Manage your brand's approved logos, signage, menu boards, campaigns and templates."
        action={
          <Link href="/franchisor/artwork/upload" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Upload className="h-4 w-4" /> Upload Artwork
          </Link>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 px-3 py-2 text-sm text-status-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>You can upload, replace, archive and deprecate artwork for your own brand. Downloads use secure links that expire after 5 minutes.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* Category sidebar (desktop) / chips (mobile) */}
        <aside>
          <CategoryChips categories={[{ name: "all", count: totalCount }, ...categories]} active={activeCategory} basePath="/franchisor/artwork" currentParams={q.raw} />
        </aside>

        <div>
          <ListToolbar searchPlaceholder="Search files…" />

          {rows.length === 0 ? (
            <EmptyState title="No artwork found" description={q.search || activeCategory !== "all" ? "Try a different category or search." : "Upload your first asset to get started."} icon={FileImage} />
          ) : (
            <FranchisorArtworkListSection rows={rows} total={total} />
          )}

          <div className="flex items-center justify-between">
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Images className="h-3 w-3" /> {total} file{total === 1 ? "" : "s"}</p>
            <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/franchisor/artwork", q.raw, { page: p })} />
          </div>
        </div>
      </div>
    </div>
  );
}
