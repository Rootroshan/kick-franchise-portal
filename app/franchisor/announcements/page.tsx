import { Plus } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorAnnouncements } from "@/server/modules/announcements/franchisorList";
import { getAnnouncementRecentActivity, getFeaturedAckAnnouncement, getAnnouncementKpis } from "@/server/modules/announcements/admin";
import { getAcknowledgementSummary } from "@/server/modules/announcements/service";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, Pagination, PrimaryButtonLink, EmptyState } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { SortSelect } from "@/components/admin/SortSelect";
import { FilterTabs } from "@/components/franchisor/shared/FilterTabs";
import { AnnouncementListCard } from "@/components/franchisor/announcements/AnnouncementListCard";
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
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total, counts }, kpis, activity, featuredAck] = await Promise.all([
    listFranchisorAnnouncements(ctx, ctx.tenantId, q),
    getAnnouncementKpis(ctx),
    getAnnouncementRecentActivity(ctx, ctx.tenantId, 8),
    getFeaturedAckAnnouncement(ctx, ctx.tenantId),
  ]);
  const pages = pageCount(total, q.limit);
  const ackSummary = featuredAck ? await getAcknowledgementSummary(ctx, ctx.tenantId, featuredAck.id) : null;

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

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <OverviewCard kpis={kpis} />

          <FilterTabs tabs={tabs} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <ListToolbar searchPlaceholder="Search announcements…" />
            </div>
            <SortSelect options={SORT_OPTIONS} />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No announcements found"
              description={q.search || q.status ? "Try different filters." : "Publish your first brand announcement."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((a) => (
                <AnnouncementListCard key={a.id} a={a} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{total} announcement{total === 1 ? "" : "s"}</p>
            <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/franchisor/announcements", q.raw, { page: p })} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          {ackSummary && featuredAck && (
            <AcknowledgementSummaryCard
              summary={ackSummary}
              announcementTitle={featuredAck.title}
              reportHref={`/franchisor/announcements/${featuredAck.id}/report`}
            />
          )}
          <PublishCalendarCard ctx={ctx} tenantId={ctx.tenantId} raw={q.raw} />
          <RecentActivityCard activity={activity} />
        </aside>
      </div>
    </div>
  );
}
