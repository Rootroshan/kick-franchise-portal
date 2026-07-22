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
import { MoreVertical, Send, Archive, Pin, PinOff, FileBarChart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import {
  setAnnouncementStatusAction,
  toggleAnnouncementPinAction,
  bulkDeleteAnnouncementsAction,
} from "@/app/admin/announcements/announcementActions";

type Kind = "publish" | "expire" | "archive" | "pin" | "report" | "delete";

/** Three-dot menu for the admin announcement card — same Floating UI pattern as ArtworkRowMenu/BrandRowMenu. */
export function AnnouncementCardMenu({
  id,
  title,
  status,
  isPinned,
  requiresAck,
}: {
  id: string;
  title: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [pending, startTransition] = useTransition();

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

  const items: Array<{ icon: typeof Send; label: string; kind: Kind; destructive?: boolean }> = [
    ...(status === "SCHEDULED" || status === "DRAFT" ? [{ icon: Send, label: "Publish now", kind: "publish" as const }] : []),
    ...(status === "PUBLISHED" ? [{ icon: Archive, label: "Expire", kind: "expire" as const }] : []),
    ...(status !== "ARCHIVED" ? [{ icon: Archive, label: "Archive", kind: "archive" as const }] : []),
    { icon: isPinned ? PinOff : Pin, label: isPinned ? "Unpin" : "Pin", kind: "pin" },
    ...(requiresAck ? [{ icon: FileBarChart, label: "View acknowledgement report", kind: "report" as const }] : []),
    { icon: Trash2, label: "Delete", kind: "delete" as const, destructive: true },
  ];

  const runAction = (kind: Exclude<Kind, "report">) => {
    if (kind === "publish") return setAnnouncementStatusAction(id, "PUBLISHED");
    if (kind === "expire") return setAnnouncementStatusAction(id, "EXPIRED");
    if (kind === "archive") return setAnnouncementStatusAction(id, "ARCHIVED");
    if (kind === "delete") return bulkDeleteAnnouncementsAction([id]);
    return toggleAnnouncementPinAction(id, !isPinned);
  };

  const onPick = (kind: Kind) => {
    setOpen(false);
    if (kind === "report") {
      router.push(`/admin/announcements/${id}/report`);
      return;
    }
    if (kind === "delete" && !window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await runAction(kind);
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed.");
      }
    });
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
        aria-label={`Actions for ${title}`}
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

      {pending && <LoadingOverlay message="Processing…" />}
    </>
  );
}
