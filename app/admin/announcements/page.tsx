import { Megaphone, CheckCircle2, Clock, FileEdit, Pin } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncementsAdmin, getAnnouncementKpis } from "@/server/modules/announcements/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { AnnouncementRow } from "@/server/modules/announcements/admin";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listAnnouncementsAdmin(ctx, q),
    getAnnouncementKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<AnnouncementRow>[] = [
    {
      key: "title",
      header: "Announcement",
      sortKey: "title",
      cell: (a) => (
        <div className="flex items-center gap-2">
          {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-label="Pinned" />}
          <div>
            <div className="font-medium text-foreground">{a.title}</div>
            {a.requiresAck && <div className="text-xs text-status-info">Requires acknowledgement</div>}
          </div>
        </div>
      ),
    },
    { key: "brand", header: "Brand", cell: (a) => <span className="text-muted-foreground">{a.brandName}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (a) => <StatusBadge status={a.status} /> },
    { key: "acks", header: "Acks", hideOnMobile: true, cell: (a) => <span className="tabular-nums">{a.requiresAck ? a.ackCount : "—"}</span> },
    {
      key: "publishAt",
      header: "Publish",
      sortKey: "publishAt",
      hideOnMobile: true,
      cell: (a) => <span className="text-muted-foreground">{a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Announcements" description="Every announcement across all brands, with acknowledgement tracking." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total" value={kpis.total} icon={Megaphone} tone="info" />
        <KPIStatCard label="Published" value={kpis.published} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Scheduled" value={kpis.scheduled} icon={Clock} tone="warning" />
        <KPIStatCard label="Drafts" value={kpis.drafts} icon={FileEdit} tone="purple" />
      </div>

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

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        basePath="/admin/announcements"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No announcements found", description: q.search || q.brand || q.status ? "Try different filters." : "Announcements from all brands appear here." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} announcement{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/announcements", q.raw, { page: p })} />
      </div>
    </div>
  );
}
