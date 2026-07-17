import Link from "next/link";
import { Images, FileImage, Upload, Info } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorAssets } from "@/server/modules/assets/franchisorList";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { formatBytes } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { CategoryChips } from "@/components/franchisor/artwork/CategoryChips";

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
        description="Brand assets and downloadable files, managed centrally by Kick."
        action={
          <Link href="/franchisor/artwork/upload" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Upload className="h-4 w-4" /> Upload New
          </Link>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 px-3 py-2 text-sm text-status-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Artwork is centrally managed by Kick Media. You can preview and download all active assets. Downloads use secure links that expire after 5 minutes.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* Category sidebar (desktop) / chips (mobile) */}
        <aside>
          <CategoryChips categories={[{ name: "all", count: totalCount }, ...categories]} active={activeCategory} basePath="/franchisor/artwork" currentParams={q.raw} />
        </aside>

        <div>
          <ListToolbar searchPlaceholder="Search files…" />

          {rows.length === 0 ? (
            <EmptyState title="No artwork found" description={q.search || activeCategory !== "all" ? "Try a different category or search." : "Assets uploaded by Kick appear here."} icon={FileImage} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {rows.map((a) => (
                <Link key={a.id} href={`/franchisor/artwork/${a.id}`} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40">
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    <FileImage className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="flex items-start justify-between gap-1">
                      <span className="truncate text-sm font-medium" title={a.name}>{a.name}</span>
                      {a.version > 1 && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">v{a.version}</span>}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{a.category ?? "Other"} · {a.mime.split("/")[1]?.toUpperCase()}</span>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <StatusBadge status={a.status} />
                      <span className="text-[11px] text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
