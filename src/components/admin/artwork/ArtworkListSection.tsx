"use client";

import { useEffect, useState } from "react";
import { BulkSelectionProvider, useBulkSelection } from "@/components/admin/bulk/BulkSelection";
import { BulkActionToolbar } from "@/components/admin/bulk/BulkActionToolbar";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatBytes, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/kit";
import { FileImage, Archive, CheckCircle, Ban, RotateCcw, LayoutGrid, Table as TableIcon } from "lucide-react";
import type { AssetRow } from "@/server/modules/assets/admin";
import { bulkArchiveAssetsAction, bulkActivateAssetsAction, bulkDeprecateAssetsAction, bulkRestoreAssetsAction } from "@/app/admin/artwork/artworkActions";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { ArtworkRowMenu } from "@/components/admin/artwork/ArtworkRowMenu";
import { cn } from "@/lib/utils";

type Props = {
  rows: AssetRow[];
  total: number;
};

const ARTWORK_ACTIONS: BulkActionDef[] = [
  { key: "activate", label: "Activate", icon: CheckCircle, tone: "success", action: bulkActivateAssetsAction },
  { key: "restore", label: "Restore", icon: RotateCcw, tone: "success", action: bulkRestoreAssetsAction },
  { key: "deprecate", label: "Deprecate", icon: Ban, tone: "warning", action: bulkDeprecateAssetsAction },
  { key: "archive", label: "Archive", icon: Archive, tone: "warning", action: bulkArchiveAssetsAction },
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
  const [view, setView] = useState<"grid" | "table">("grid");

  useEffect(() => {
    setPage(rows.map((a) => a.id), total);
  }, [rows, setPage, total]);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <div className="inline-flex overflow-hidden rounded-md border border-input">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={cn("p-1.5", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-label="Table view"
            aria-pressed={view === "table"}
            className={cn("p-1.5 border-l border-input", view === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}
          >
            <TableIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BulkActionToolbar actions={ARTWORK_ACTIONS} itemName="asset" />

      {view === "grid" ? (
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
                  <div className="absolute right-2 top-2 z-10">
                    <ArtworkRowMenu asset={a} basePath="/admin/artwork" />
                  </div>
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
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left">Brand</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">Size</th>
                <th className="px-3 py-2.5 text-left">Version</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Uploaded</th>
                <th className="px-3 py-2.5 text-left">Uploaded By</th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const selected = isSelected(a.id);
                return (
                  <tr key={a.id} className={cn("border-t border-border", selected && "bg-status-info/5")}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected} onChange={() => toggle(a.id)} className="h-4 w-4 cursor-pointer rounded border-input accent-primary" aria-label={`Select ${a.name}`} />
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 font-medium" title={a.name}>{a.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.brandName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.category ?? "Other"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.type}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatBytes(a.sizeBytes)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">v{a.version}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(a.createdAt)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.uploaderName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right"><ArtworkRowMenu asset={a} basePath="/admin/artwork" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {actionState.loading && <LoadingOverlay message="Processing request…" />}
    </>
  );
}
