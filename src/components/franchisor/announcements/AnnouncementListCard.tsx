import Link from "next/link";
import { Pin, CheckSquare, Eye, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/admin/kit";
import type { FranchisorAnnouncementRow } from "@/server/modules/announcements/franchisorList";

/** Franchisor announcement card — replaces the old table+mobile-list rows with one card grid. */
export function AnnouncementListCard({ a }: { a: FranchisorAnnouncementRow }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-label="Pinned" />}
          <span className="font-medium">{a.title}</span>
        </div>
        <StatusBadge status={a.status} />
      </div>

      <p className="line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{a.targetStores} stores</span>
        {a.requiresAck ? (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-status-success" style={{ width: `${a.readPercent}%` }} />
            </span>
            <span className="tabular-nums">{a.ackCount}/{a.targetStores} ({a.readPercent}%)</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Not required</span>
        )}
        <span>{a.publishAt ? a.publishAt.toLocaleDateString() : "—"}</span>
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-border pt-2">
        <Link href={`/franchisor/announcements/${a.id}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
          <Eye className="h-3.5 w-3.5" /> View
        </Link>
        <Link href={`/franchisor/announcements/${a.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
        {a.requiresAck && (
          <Link href={`/franchisor/announcements/${a.id}/report`} className="ml-auto text-xs font-medium text-status-info hover:underline">
            View report
          </Link>
        )}
      </div>
    </div>
  );
}
