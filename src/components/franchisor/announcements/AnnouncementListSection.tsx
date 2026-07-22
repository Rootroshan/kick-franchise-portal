"use client";

import { useEffect } from "react";
import { Clock, Archive, Pin } from "lucide-react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar, type BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { FranchisorAnnouncementRow } from "@/server/modules/announcements/franchisorList";
import {
  bulkExpireFranchisorAnnouncementsAction,
  bulkArchiveFranchisorAnnouncementsAction,
  bulkPinFranchisorAnnouncementsAction,
} from "@/app/franchisor/announcements/actions";
import { AnnouncementListCard } from "./AnnouncementListCard";

const FRANCHISOR_ANNOUNCEMENT_ACTIONS: BulkActionDef[] = [
  { key: "pin", label: "Pin", icon: Pin, tone: "default", action: bulkPinFranchisorAnnouncementsAction },
  { key: "expire", label: "Expire", icon: Clock, tone: "warning", action: bulkExpireFranchisorAnnouncementsAction },
  { key: "archive", label: "Archive", icon: Archive, tone: "warning", action: bulkArchiveFranchisorAnnouncementsAction },
];

export function AnnouncementListSection({ rows, total }: { rows: FranchisorAnnouncementRow[]; total: number }) {
  return (
    <BulkSelectionProvider>
      <AnnouncementListSectionInner rows={rows} total={total} />
    </BulkSelectionProvider>
  );
}

function AnnouncementListSectionInner({ rows, total }: { rows: FranchisorAnnouncementRow[]; total: number }) {
  const { setPage, isSelected, toggle, actionState } = useBulkSelection();

  useEffect(() => {
    setPage(rows.map((a) => a.id), total);
  }, [rows, setPage, total]);

  return (
    <>
      <BulkActionToolbar actions={FRANCHISOR_ANNOUNCEMENT_ACTIONS} itemName="announcement" />

      <div className="flex flex-col gap-3">
        {rows.map((a) => (
          <AnnouncementListCard key={a.id} a={a} selected={isSelected(a.id)} onToggleSelect={() => toggle(a.id)} />
        ))}
      </div>

      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
