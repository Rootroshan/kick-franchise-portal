"use client";

import { useEffect } from "react";
import { Megaphone, Pin, Send, Trash2 } from "lucide-react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar, type BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { StatusBadge } from "@/components/admin/kit";
import { cn } from "@/lib/utils";
import type { AnnouncementRow } from "@/server/modules/announcements/admin";
import { bulkPublishAnnouncementsAction, bulkDeleteAnnouncementsAction } from "@/app/admin/announcements/announcementActions";
import { AnnouncementCardMenu } from "./AnnouncementCardMenu";

const ANNOUNCEMENT_ACTIONS: BulkActionDef[] = [
  { key: "publish", label: "Publish", icon: Send, tone: "success", action: bulkPublishAnnouncementsAction },
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((a) => {
          const selected = isSelected(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
                selected ? "border-status-info/40 bg-status-info/5" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(a.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                    aria-label={`Select ${a.title}`}
                  />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Megaphone className="h-4 w-4 text-status-info" />
                  </div>
                </div>
                <AnnouncementCardMenu id={a.id} title={a.title} status={a.status} isPinned={a.isPinned} requiresAck={a.requiresAck} />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-label="Pinned" />}
                  <span className="font-medium text-foreground">{a.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={a.status} />
                <span>{a.brandName}</span>
                {a.requiresAck && <span className="tabular-nums">{a.ackCount} acknowledged</span>}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                <span>Publish {a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</span>
                <span>Expires {a.expiresAt ? a.expiresAt.toLocaleDateString() : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
