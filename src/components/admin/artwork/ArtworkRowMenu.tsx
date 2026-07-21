"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  useListNavigation,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import { MoreVertical, Eye, RefreshCw, History, Archive, Ban, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetchJson";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { DownloadAssetButton } from "@/components/admin/artwork/DownloadAssetButton";
import { EditAssetMetadataDialog } from "@/components/admin/artwork/EditAssetMetadataDialog";

type AssetLike = { id: string; name: string; category: string | null; status: string };

type Kind = "view" | "replace" | "versions" | "edit" | "archive" | "deprecate" | "restore";

export function ArtworkRowMenu({
  asset,
  basePath,
  detailHref,
}: {
  asset: AssetLike;
  /** e.g. "/admin/artwork" or "/franchisor/artwork" — used to build replace/versions links. */
  basePath: string;
  /** e.g. "/franchisor/artwork/:id" — omit to hide "View Details" (admin has no detail page). */
  detailHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [pending, startTransition] = useTransition();
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const listNav = useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, role, listNav]);

  const items: Array<{ icon: typeof Eye; label: string; kind: Kind; destructive?: boolean }> = [
    ...(detailHref ? [{ icon: Eye, label: "Preview", kind: "view" as const }] : []),
    { icon: RefreshCw, label: "Replace with New Version", kind: "replace" },
    { icon: History, label: "Version History", kind: "versions" },
    { icon: Pencil, label: "Edit Metadata", kind: "edit" },
    ...(asset.status !== "ARCHIVED" ? [{ icon: Archive, label: "Archive", kind: "archive" as const }] : []),
    ...(asset.status !== "DEPRECATED" ? [{ icon: Ban, label: "Deprecate", kind: "deprecate" as const }] : []),
    ...(asset.status !== "ACTIVE" ? [{ icon: RotateCcw, label: "Restore", kind: "restore" as const }] : []),
  ];

  async function runStatusChange(kind: "archive" | "deprecate" | "restore") {
    const endpoint = kind === "restore" ? "restore" : kind === "deprecate" ? "deprecate" : "archive";
    const message = { archive: "Archiving asset…", deprecate: "Marking deprecated…", restore: "Restoring asset…" }[kind];
    setLoadingMessage(message);
    try {
      await fetchJson(`/api/assets/${asset.id}/${endpoint}`, { method: "POST" });
      toast.success(`Asset ${kind === "restore" ? "restored" : kind === "deprecate" ? "deprecated" : "archived"}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoadingMessage(null);
    }
  }

  const onPick = (kind: Kind) => {
    setOpen(false);
    switch (kind) {
      case "view":
        if (detailHref) router.push(detailHref);
        break;
      case "replace":
        router.push(`${basePath}/${asset.id}/replace`);
        break;
      case "versions":
        router.push(`${basePath}/${asset.id}/versions`);
        break;
      case "edit":
        setEditOpen(true);
        break;
      default:
        startTransition(() => runStatusChange(kind));
    }
  };

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: (e) => {
            e.stopPropagation();
            setOpen(!open);
          },
        })}
        className="rounded-md border border-border bg-card/90 p-1.5 hover:bg-muted"
        aria-label={`Actions for ${asset.name}`}
        aria-expanded={open}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-50 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              <div className="px-3 py-2 text-left text-sm hover:bg-muted">
                <DownloadAssetButton assetId={asset.id} className="w-full" />
              </div>
              {items.map((item, i) => (
                <button
                  key={item.kind}
                  ref={(node) => {
                    listRef.current[i] = node;
                  }}
                  role="menuitem"
                  tabIndex={activeIndex === i ? 0 : -1}
                  {...getItemProps({
                    onClick: (e) => {
                      e.stopPropagation();
                      onPick(item.kind);
                    },
                  })}
                  className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted", activeIndex === i && "bg-muted")}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}

      {editOpen && <EditAssetMetadataDialog asset={asset} onClose={() => setEditOpen(false)} onSaved={() => router.refresh()} />}

      {(pending || loadingMessage) && <LoadingOverlay message={loadingMessage ?? "Processing…"} />}
    </>
  );
}
