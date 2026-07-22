import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import {
  listAnnouncementsAdmin,
  getAnnouncementKpis,
  getAnnouncementRecentActivity,
  getFeaturedAckAnnouncement,
} from "@/server/modules/announcements/admin";
import { getAcknowledgementSummary } from "@/server/modules/announcements/service";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, pageCount } from "@/lib/adminQuery";
import { PageHeader } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { SortSelect } from "@/components/admin/SortSelect";
import { FilterTabs } from "@/components/franchisor/shared/FilterTabs";
import { AnnouncementListSection } from "@/components/admin/announcements/AnnouncementListSection";
import { ListFooter } from "@/components/admin/announcements/ListFooter";
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

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
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
      <PageHeader
        title="Announcements"
        description="Create, manage and publish important updates for your franchise network."
        action={
          <Link
            href="/admin/announcements/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Create Announcement
          </Link>
        }
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <FilterTabs tabs={STATUS_TABS} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <ListToolbar
                searchPlaceholder="Search announcements…"
                filters={[{ key: "brand", label: "Brand", options: brandOptions }]}
                className="mb-0"
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

          <ListFooter basePath="/admin/announcements" raw={q.raw} page={q.page} limit={q.limit} total={total} pageCount={pages} />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <OverviewCard kpis={kpis} />
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
