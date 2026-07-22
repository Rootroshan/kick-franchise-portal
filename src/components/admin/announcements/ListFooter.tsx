import Link from "next/link";
import { Pagination } from "@/components/admin/kit";
import { buildHref } from "@/lib/adminQuery";
import { cn } from "@/lib/utils";

/**
 * List footer per the approved design: "Showing X to Y of Z announcements"
 * on the left, page numbers + rows-per-page selector on the right. URL-driven
 * like every admin list (limit/page params via buildHref).
 */
export function ListFooter({
  basePath,
  raw,
  page,
  limit,
  total,
  pageCount,
}: {
  basePath: string;
  raw: Record<string, string>;
  page: number;
  limit: number;
  total: number;
  pageCount: number;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Showing {from} to {to} of {total} announcement{total === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Pagination page={page} pageCount={pageCount} makeHref={(p) => buildHref(basePath, raw, { page: p })} />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Rows per page</span>
          {[10, 20, 50].map((n) => (
            <Link
              key={n}
              href={buildHref(basePath, raw, { limit: n, page: 1 })}
              className={cn(
                "rounded-md border px-2 py-1 font-medium",
                limit === n ? "border-status-info text-status-info" : "border-border hover:bg-muted"
              )}
            >
              {n}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
