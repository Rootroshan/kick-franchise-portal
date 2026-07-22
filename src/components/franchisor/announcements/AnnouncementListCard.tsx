import Link from "next/link";
import { Pin, Eye, Pencil, CalendarDays, CheckCircle2, Megaphone, CalendarClock, FileEdit, FileText, Info, Archive } from "lucide-react";
import { StatusBadge } from "@/components/admin/kit";
import { cn } from "@/lib/utils";
import type { FranchisorAnnouncementRow } from "@/server/modules/announcements/franchisorList";

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

function iconFor(a: FranchisorAnnouncementRow) {
  if (a.status === "DRAFT") return { Icon: FileEdit, cls: "bg-muted text-muted-foreground" };
  if (a.status === "SCHEDULED") return { Icon: CalendarClock, cls: "bg-status-warning/10 text-status-warning" };
  if (a.status === "EXPIRED") return { Icon: Info, cls: "bg-muted text-muted-foreground" };
  if (a.status === "ARCHIVED") return { Icon: Archive, cls: "bg-muted text-muted-foreground" };
  if (a.isPinned) return { Icon: Megaphone, cls: "bg-violet-100 text-violet-600" };
  return { Icon: FileText, cls: "bg-status-info/10 text-status-info" };
}

function dateLine(a: FranchisorAnnouncementRow): string {
  if (a.status === "DRAFT") return `Draft • Last edited ${fmtDate(a.updatedAt)}`;
  if (a.status === "ARCHIVED") return `Archived • Last edited ${fmtDate(a.updatedAt)}`;
  if (a.status === "SCHEDULED" && a.publishAt) return `Publish ${fmtDateTime(a.publishAt)}`;
  const published = a.publishAt ? `Published ${fmtDate(a.publishAt)}` : "Published";
  if (a.status === "EXPIRED" && a.expiresAt) return `${published} • Expired ${fmtDate(a.expiresAt)}`;
  return a.expiresAt ? `${published} • Expires ${fmtDate(a.expiresAt)}` : published;
}

/** Franchisor announcement row card — same visual language as the approved admin design. */
export function AnnouncementListCard({
  a,
  selected,
  onToggleSelect,
}: {
  a: FranchisorAnnouncementRow;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { Icon, cls } = iconFor(a);
  const showAckCount = a.requiresAck && (a.status === "PUBLISHED" || a.status === "EXPIRED");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors sm:flex-row sm:gap-4",
        selected ? "border-status-info/40 bg-status-info/5" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            className="mt-3.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
            aria-label={`Select ${a.title}`}
          />
        )}
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
          {a.targetStores} store{a.targetStores === 1 ? "" : "s"}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <Link href={`/franchisor/announcements/${a.id}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
          <Link href={`/franchisor/announcements/${a.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
        <StatusBadge status={a.status} />
        {a.requiresAck ? (
          <div className="flex items-center gap-2 text-xs">
            {showAckCount ? (
              <Link
                href={`/franchisor/announcements/${a.id}/report`}
                className="inline-flex items-center gap-1 rounded-full border border-status-info/30 bg-status-info/5 px-2 py-0.5 font-medium tabular-nums text-status-info hover:bg-status-info/10"
                title="View acknowledgement report"
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {a.ackCount} / {a.targetStores} ({a.readPercent}%)
              </Link>
            ) : (
              <span className="font-medium text-status-info">Requires Acknowledgement</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
