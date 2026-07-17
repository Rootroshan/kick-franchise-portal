"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Copy, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { togglePinAction, expireAnnouncementAction, duplicateAnnouncementAction, deleteDraftAction } from "@/app/franchisor/announcements/actions";

/** Action bar for the announcement detail page. Wraps server actions with
 *  transitions, toasts, and a confirm for destructive ones. */
export function AnnouncementActions({ id, isPinned, status }: { id: string; isPinned: boolean; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<void>, ok: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  const isDraft = status === "DRAFT";
  const isExpired = status === "EXPIRED";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => run(() => togglePinAction(id, !isPinned), isPinned ? "Unpinned" : "Pinned")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        {isPinned ? "Unpin" : "Pin"}
      </button>

      <button
        onClick={() => run(() => duplicateAnnouncementAction(id), "Duplicated as draft")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Copy className="h-4 w-4" /> Duplicate
      </button>

      {!isExpired && !isDraft && (
        <button
          onClick={() => run(() => expireAnnouncementAction(id), "Expired", "Expire this announcement? Stores will no longer see it.")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          <Archive className="h-4 w-4" /> Expire
        </button>
      )}

      {isDraft && (
        <button
          onClick={() => run(() => deleteDraftAction(id), "Draft deleted", "Delete this draft? This cannot be undone.")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-status-error/40 bg-card px-3 py-2 text-sm font-medium text-status-error hover:bg-status-error/5 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" /> Delete Draft
        </button>
      )}
    </div>
  );
}
