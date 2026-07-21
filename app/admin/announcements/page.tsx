import { requireRole } from "@/server/modules/identity/guard";
import {
  listAnnouncementsAdmin,
  getAnnouncementKpis,
  getAnnouncementRecentActivity,
  getFeaturedAckAnnouncement,
} from "@/server/modules/announcements/admin";
import { getAcknowledgementSummary } from "@/server/modules/announcements/service";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { SortSelect } from "@/components/admin/SortSelect";
import { AnnouncementListSection } from "@/components/admin/announcements/AnnouncementListSection";
import { OverviewCard } from "@/components/admin/announcements/OverviewCard";
import { AcknowledgementSummaryCard } from "@/components/admin/announcements/AcknowledgementSummaryCard";
import { PublishCalendarCard } from "@/components/admin/announcements/PublishCalendarCard";
import { RecentActivityCard } from "@/components/admin/announcements/RecentActivityCard";

export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First", sort: "createdAt", direction: "desc" as const },
  { value: "oldest", label: "Oldest First", sort: "createdAt", direction: "asc" as const },
  { value: "title-asc", label: "Title A–Z", sort: "title", direction: "asc" as const },
  { value: "publish-desc", label: "Publish Date", sort: "publishAt", direction: "desc" as const },
];

export default async function AnnouncementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions, activity, featuredAck] = await Promise.all([
    listAnnouncementsAdmin(ctx, q),
    getAnnouncementKpis(ctx),
    getBrandFilterOptions(ctx),
    getAnnouncementRecentActivity(ctx, undefined, 8),
    getFeaturedAckAnnouncement(ctx),
  ]);
  const pages = pageCount(total, q.limit);
  const ackSummary = featuredAck ? await getAcknowledgementSummary(ctx, undefined, featuredAck.id) : null;

  return (
    <div>
      <PageHeader title="Announcements" description="Every announcement across all brands, with acknowledgement tracking." />

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <OverviewCard kpis={kpis} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <ListToolbar
                searchPlaceholder="Search announcements…"
                filters={[
                  { key: "brand", label: "Brand", options: brandOptions },
                  {
                    key: "status",
                    label: "Status",
                    options: [
                      { value: "DRAFT", label: "Draft" },
                      { value: "SCHEDULED", label: "Scheduled" },
                      { value: "PUBLISHED", label: "Published" },
                      { value: "EXPIRED", label: "Expired" },
                    ],
                  },
                ]}
              />
            </div>
            <SortSelect options={SORT_OPTIONS} />
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              {q.search || q.brand || q.status ? "No announcements match your filters." : "Announcements from all brands appear here."}
            </div>
          ) : (
            <AnnouncementListSection rows={rows} total={total} />
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{total} announcement{total === 1 ? "" : "s"} total</p>
            <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/announcements", q.raw, { page: p })} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          {ackSummary && featuredAck && (
            <AcknowledgementSummaryCard
              summary={ackSummary}
              announcementTitle={featuredAck.title}
              reportHref={`/admin/announcements/${featuredAck.id}/report`}
            />
          )}
          {/* Cross-tenant (no tenantId) — admin's list is brand-agnostic;
              scoping the calendar to a ?brand= slug would need a slug->id
              lookup this widget doesn't otherwise need. */}
          <PublishCalendarCard ctx={ctx} tenantId={undefined} raw={q.raw} />
          <RecentActivityCard activity={activity} auditLogHref="/admin/audit-log?entity=Announcement" />
        </aside>
      </div>
    </div>
  );
}
