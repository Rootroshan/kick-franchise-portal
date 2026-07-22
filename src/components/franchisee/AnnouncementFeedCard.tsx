import Link from "next/link";
import { CalendarClock, CalendarDays, Info, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AcknowledgeButton } from "./AcknowledgeButton";
import { cn } from "@/lib/utils";

/** Plain shape the feed/detail/rail cards render — derived server-side from listAnnouncements rows. */
export type FeedAnnouncement = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  requiresAck: boolean;
  publishAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  acked: boolean;
  unread: boolean;
};

// en-US explicitly (not the runtime default locale) so server render output is
// deterministic — these cards are server components, but keep it consistent
// with the hydration-safety rule used across the app.
export function formatPublishedAt(value: Date): string {
  const date = value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

export function formatExpiry(value: Date | null): string {
  if (!value) return "No expiry";
  return `Expires ${value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function IconTile({ announcement: a, className }: { announcement: FeedAnnouncement; className?: string }) {
  const Icon = a.isPinned ? Megaphone : a.requiresAck ? Info : CalendarClock;
  return (
    <span
      className={cn(
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg",
        a.isPinned ? "bg-amber-100 text-amber-700" : a.requiresAck ? "bg-blue-50 text-blue-600" : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-7 w-7" />
    </span>
  );
}

function PinnedPill() {
  return (
    <Badge variant="warning" className="gap-1">
      <span aria-hidden="true">📌</span> PINNED
    </Badge>
  );
}

/** One announcement in the store feed. */
export function AnnouncementFeedCard({ announcement: a }: { announcement: FeedAnnouncement }) {
  return (
    <article
      className={cn(
        "relative flex gap-4 rounded-xl border p-4 shadow-sm",
        a.isPinned ? "border-amber-200 bg-amber-50/70" : "border-border bg-card"
      )}
    >
      {a.unread && (
        <span
          className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
          role="img"
          aria-label="Unread"
        />
      )}
      <IconTile announcement={a} />
      <div className="min-w-0 flex-1">
        {a.isPinned && (
          <div className="mb-1">
            <PinnedPill />
          </div>
        )}
        <h3 className={cn("text-sm sm:text-base", a.unread ? "font-bold" : "font-semibold")}>
          <Link href={`/announcements/${a.id}`} className="hover:underline">
            {a.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>

        {(a.requiresAck || a.acked) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {a.requiresAck && !a.acked && <Badge variant="warning">Requires Acknowledgement</Badge>}
            <AcknowledgeButton id={a.id} acked={a.acked} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Published {formatPublishedAt(a.publishAt ?? a.createdAt)}
          </span>
          <span>{formatExpiry(a.expiresAt)}</span>
        </div>
      </div>
    </article>
  );
}

/** Right-rail "Pinned Announcement" card — the top pinned visible announcement. */
export function PinnedRailCard({ announcement: a }: { announcement: FeedAnnouncement }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Pinned Announcement</h2>
        <Link href="/announcements?tab=Pinned" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <IconTile announcement={a} className="h-12 w-12" />
        <div>
          <PinnedPill />
        </div>
        <h3 className="text-sm font-semibold">
          <Link href={`/announcements/${a.id}`} className="hover:underline">
            {a.title}
          </Link>
        </h3>
        {a.requiresAck && !a.acked && <Badge variant="warning">Requires Acknowledgement</Badge>}
        <p className="text-xs text-muted-foreground">{formatExpiry(a.expiresAt)}</p>
        {(a.requiresAck || a.acked) && <AcknowledgeButton id={a.id} acked={a.acked} fullWidth />}
      </div>
    </div>
  );
}
