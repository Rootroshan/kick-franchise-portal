"use client";

import { useEffect } from "react";
import { Megaphone, Pin, Send, Trash2, Clock, Archive, CalendarDays, CalendarClock, FileEdit, FileText, Info, CheckCircle2 } from "lucide-react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar, type BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { StatusBadge } from "@/components/admin/kit";
import { cn } from "@/lib/utils";
import type { AnnouncementRow } from "@/server/modules/announcements/admin";
import {
  bulkPublishAnnouncementsAction,
  bulkDeleteAnnouncementsAction,
  bulkExpireAnnouncementsAction,
  bulkArchiveAnnouncementsAction,
  bulkPinAnnouncementsAction,
} from "@/app/admin/announcements/announcementActions";
import { AnnouncementCardMenu } from "./AnnouncementCardMenu";

const ICON_CLS = "h-3.5 w-3.5";
const ANNOUNCEMENT_ACTIONS: BulkActionDef[] = [
  { key: "publish", label: "Publish", icon: <Send className={ICON_CLS} aria-hidden="true" />, tone: "success", action: bulkPublishAnnouncementsAction },
  { key: "pin", label: "Pin", icon: <Pin className={ICON_CLS} aria-hidden="true" />, tone: "default", action: bulkPinAnnouncementsAction },
  { key: "expire", label: "Expire", icon: <Clock className={ICON_CLS} aria-hidden="true" />, tone: "warning", action: bulkExpireAnnouncementsAction },
  { key: "archive", label: "Archive", icon: <Archive className={ICON_CLS} aria-hidden="true" />, tone: "warning", action: bulkArchiveAnnouncementsAction },
  {
    key: "delete",
    label: "Delete",
    icon: <Trash2 className={ICON_CLS} aria-hidden="true" />,
    tone: "destructive",
    confirmTitle: "Delete selected announcements?",
    confirmMessage: "Published announcements will be removed from all stores.",
    action: bulkDeleteAnnouncementsAction,
  },
];

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

/** Status → icon-tile treatment, matching the approved design's colored squares. */
function iconFor(a: AnnouncementRow) {
  if (a.status === "DRAFT") return { Icon: FileEdit, cls: "bg-muted text-muted-foreground" };
  if (a.status === "SCHEDULED") return { Icon: CalendarClock, cls: "bg-status-warning/10 text-status-warning" };
  if (a.status === "EXPIRED") return { Icon: Info, cls: "bg-muted text-muted-foreground" };
  if (a.status === "ARCHIVED") return { Icon: Archive, cls: "bg-muted text-muted-foreground" };
  // PUBLISHED — pinned gets the design's violet megaphone, others the blue file
  if (a.isPinned) return { Icon: Megaphone, cls: "bg-violet-100 text-violet-600" };
  return { Icon: FileText, cls: "bg-status-info/10 text-status-info" };
}

function dateLine(a: AnnouncementRow): string {
  if (a.status === "DRAFT") return `Draft • Last edited ${fmtDate(a.updatedAt)}`;
  if (a.status === "ARCHIVED") return `Archived • Last edited ${fmtDate(a.updatedAt)}`;
  if (a.status === "SCHEDULED" && a.publishAt) return `Publish ${fmtDateTime(a.publishAt)}`;
  const published = a.publishAt ? `Published ${fmtDate(a.publishAt)}` : `Created ${fmtDate(a.createdAt)}`;
  if (a.status === "EXPIRED" && a.expiresAt) return `${published} • Expired ${fmtDate(a.expiresAt)}`;
  return a.expiresAt ? `${published} • Expires ${fmtDate(a.expiresAt)}` : published;
}

export function AnnouncementListSection({ rows, total }: { rows: AnnouncementRow[]; total: number }) {
  return (
    <BulkSelectionProvider>
      <AnnouncementListSectionInner rows={rows} total={total} />
    </BulkSelectionProvider>
  );
}

function AnnouncementListSectionInner({ rows, total }: { rows: AnnouncementRow[]; total: number }) {
  const { setPage, isSelected, toggle, actionState } = useBulkSelection();

  useEffect(() => {
    setPage(rows.map((a) => a.id), total);
  }, [rows, setPage, total]);

  return (
    <>
      <BulkActionToolbar actions={ANNOUNCEMENT_ACTIONS} itemName="announcement" />

      <div className="flex flex-col gap-3">
        {rows.map((a) => {
          const selected = isSelected(a.id);
          const { Icon, cls } = iconFor(a);
          const showAckCount = a.requiresAck && (a.status === "PUBLISHED" || a.status === "EXPIRED");
          return (
            <div
              key={a.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors sm:flex-row sm:gap-4",
                selected ? "border-status-info/40 bg-status-info/5" : "border-border"
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(a.id)}
                  className="mt-3.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                  aria-label={`Select ${a.title}`}
                />
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", cls)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {a.isPinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                    <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
                  </span>
                )}
                <span className="truncate text-base font-semibold text-foreground">{a.title}</span>
                <p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {dateLine(a)}
                  <span aria-hidden="true">•</span>
                  {a.brandName}
                </p>
              </div>

              <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <AnnouncementCardMenu id={a.id} title={a.title} status={a.status} isPinned={a.isPinned} requiresAck={a.requiresAck} />
                </div>
                {a.requiresAck ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-status-info">
                      {showAckCount && a.ackCount > 0 ? "Acknowledged by" : "Requires Acknowledgement"}
                    </span>
                    {showAckCount ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-info/30 bg-status-info/5 px-2 py-0.5 font-medium tabular-nums text-status-info">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {a.ackCount} / {a.eligibleCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
