import { Megaphone, CheckCircle2, Clock, FileEdit, Pin } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncementsAdmin, getAnnouncementKpis } from "@/server/modules/announcements/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTableSection } from "@/components/admin/DataTableSection";
import type { AnnouncementRow } from "@/server/modules/announcements/admin";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkPublishAnnouncementsAction, bulkDeleteAnnouncementsAction } from "./announcementActions";
import { Trash2, Send } from "lucide-react";

export const dynamic = "force-dynamic";

const ANNOUNCEMENT_ACTIONS: BulkActionDef[] = [
  {
    key: "publish",
    label: "Publish",
    icon: Send,
    tone: "success",
    action: bulkPublishAnnouncementsAction,
  },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    tone: "destructive",
    confirmTitle: "Delete selected announcements?",
    confirmMessage: "Published announcements will be removed from all stores.",
    action: bulkDeleteAnnouncementsAction,
  },
];

export default async function AnnouncementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listAnnouncementsAdmin(ctx, q),
    getAnnouncementKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns = [
    {
      key: "title",
      header: "Announcement",
      sortKey: "title",
      cell: (a: AnnouncementRow) => (
        <div className="flex items-center gap-2">
          {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-label="Pinned" />}
          <div>
            <div className="font-medium text-foreground">{a.title}</div>
            {a.requiresAck && <div className="text-xs text-status-info">Requires acknowledgement</div>}
          </div>
        </div>
      ),
    },
    { key: "brand", header: "Brand", cell: (a: AnnouncementRow) => <span className="text-muted-foreground">{a.brandName}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (a: AnnouncementRow) => <StatusBadge status={a.status} /> },
    { key: "acks", header: "Acks", hideOnMobile: true, cell: (a: AnnouncementRow) => <span className="tabular-nums">{a.requiresAck ? a.ackCount : "—"}</span> },
    {
      key: "publishAt",
      header: "Publish",
      sortKey: "publishAt",
      hideOnMobile: true,
      cell: (a: AnnouncementRow) => <span className="text-muted-foreground">{a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</span>,
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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand || q.status ? "No announcements match your filters." : "Announcements from all brands appear here."}
        </div>
      ) : (
        <DataTableSection
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          basePath="/admin/announcements"
          currentParams={q.raw}
          sort={q.sort}
          direction={q.direction}
          empty={{ title: "No announcements found", description: q.search || q.brand || q.status ? "Try different filters." : "Announcements from all brands appear here." }}
          actions={ANNOUNCEMENT_ACTIONS}
          itemName="announcement"
          total={total}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} announcement{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/announcements", q.raw, { page: p })} />
      </div>
    </div>
  );
}
