import Link from "next/link";
import { Plus, Pin, CheckSquare, Eye, Pencil } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorAnnouncements } from "@/server/modules/announcements/franchisorList";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, StatusBadge, Pagination, PrimaryButtonLink, EmptyState } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { FilterTabs } from "@/components/franchisor/shared/FilterTabs";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const q = parseListQuery(searchParams);
  const { rows, total, counts } = await listFranchisorAnnouncements(ctx, ctx.tenantId, q);
  const pages = pageCount(total, q.limit);

  const tabs = [
    { value: "", label: "All", count: counts.all },
    { value: "PUBLISHED", label: "Published", count: counts.PUBLISHED ?? 0 },
    { value: "SCHEDULED", label: "Scheduled", count: counts.SCHEDULED ?? 0 },
    { value: "DRAFT", label: "Draft", count: counts.DRAFT ?? 0 },
    { value: "EXPIRED", label: "Expired", count: counts.EXPIRED ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Create and manage announcements for your stores."
        action={
          <PrimaryButtonLink href="/franchisor/announcements/new">
            <Plus className="h-4 w-4" /> New Announcement
          </PrimaryButtonLink>
        }
      />

      <FilterTabs tabs={tabs} />
      <ListToolbar searchPlaceholder="Search announcements…" />

      {rows.length === 0 ? (
        <EmptyState
          title="No announcements found"
          description={q.search || q.status ? "Try different filters." : "Publish your first brand announcement."}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Announcement</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Target</th>
                  <th className="px-3 py-2.5 font-medium">Acknowledged</th>
                  <th className="px-3 py-2.5 font-medium">Published / Scheduled</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-label="Pinned" />}
                        <div>
                          <div className="font-medium">{a.title}</div>
                          <div className="max-w-md truncate text-xs text-muted-foreground">{a.excerpt}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.targetStores} stores</td>
                    <td className="px-3 py-2.5">
                      {a.requiresAck ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-status-success" style={{ width: `${a.readPercent}%` }} />
                          </div>
                          <span className="text-xs tabular-nums">{a.ackCount}/{a.targetStores} ({a.readPercent}%)</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckSquare className="h-3 w-3" /> Not required</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/franchisor/announcements/${a.id}`} className="rounded p-1.5 hover:bg-muted" aria-label="View"><Eye className="h-4 w-4" /></Link>
                        <Link href={`/franchisor/announcements/${a.id}/edit`} className="rounded p-1.5 hover:bg-muted" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile record cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={`/franchisor/announcements/${a.id}`} className="block rounded-xl border border-border bg-card p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {a.isPinned && <Pin className="h-3.5 w-3.5 text-status-warning" aria-label="Pinned" />}
                      {a.title}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{a.targetStores} stores</span>
                    {a.requiresAck && <span className="font-medium text-status-success">{a.readPercent}% read</span>}
                    <span>{a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} announcement{total === 1 ? "" : "s"}</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/franchisor/announcements", q.raw, { page: p })} />
      </div>
    </div>
  );
}
