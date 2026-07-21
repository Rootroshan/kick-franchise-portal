"use client";

import { useEffect } from "react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatBytes } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/kit";
import { FileImage, Archive, CheckCircle } from "lucide-react";
import type { AssetRow } from "@/server/modules/assets/admin";
import { bulkArchiveAssetsAction, bulkActivateAssetsAction } from "@/app/admin/artwork/artworkActions";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { cn } from "@/lib/utils";

type Props = {
  rows: AssetRow[];
  total: number;
};

const ARTWORK_ACTIONS: BulkActionDef[] = [
  {
    key: "activate",
    label: "Activate",
    icon: CheckCircle,
    tone: "success",
    action: bulkActivateAssetsAction,
  },
  {
    key: "archive",
    label: "Archive",
    icon: Archive,
    tone: "warning",
    action: bulkArchiveAssetsAction,
  },
];

export function ArtworkListSection({ rows, total }: Props) {
  return (
    <BulkSelectionProvider>
      <ArtworkListSectionInner rows={rows} total={total} />
    </BulkSelectionProvider>
  );
}

function ArtworkListSectionInner({ rows, total }: Props) {
  const { setPage, isSelected, toggle, actionState } = useBulkSelection();

  useEffect(() => {
    setPage(rows.map((a) => a.id), total);
  }, [rows, setPage, total]);

  return (
    <>
      <BulkActionToolbar actions={ARTWORK_ACTIONS} itemName="asset" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((a) => {
          const selected = isSelected(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
                selected ? "border-status-info/40 bg-status-info/5" : "border-border"
              )}
            >
              <div className="flex aspect-video items-center justify-center bg-muted">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(a.id)}
                  className="absolute left-2 top-2 z-10 h-4 w-4 cursor-pointer rounded border-input accent-primary"
                  aria-label={`Select ${a.name}`}
                />
                <FileImage className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-medium" title={a.name}>{a.name}</span>
                  {a.version > 1 && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">v{a.version}</span>}
                </div>
                <span className="truncate text-xs text-muted-foreground">{a.brandName}</span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <StatusBadge status={a.status} />
                  <span className="text-[11px] text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
