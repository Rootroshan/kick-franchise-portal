import Link from "next/link";
import { Megaphone, CalendarClock, FileBarChart, FileEdit, CheckCircle2, Info } from "lucide-react";
import type { AnnouncementActivityRow } from "@/server/modules/announcements/admin";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Event → headline + icon, mirroring the approved design's activity rows. */
function present(a: AnnouncementActivityRow): { headline: string; Icon: typeof Megaphone } {
  switch (a.action) {
    case "announcement.create":
      return { headline: "Announcement created", Icon: FileEdit };
    case "announcement.update":
      return { headline: "Announcement edited", Icon: FileEdit };
    case "announcement.status":
      return { headline: "Announcement status changed", Icon: Info };
    case "announcement.expire":
      return { headline: "Announcement expired", Icon: CalendarClock };
    case "announcement.duplicate":
      return { headline: "Announcement duplicated", Icon: FileEdit };
    case "announcement.delete":
      return { headline: "Announcement deleted", Icon: Info };
    case "announcement.acknowledge":
      return { headline: "Announcement acknowledged", Icon: CheckCircle2 };
    case "announcement.report_view":
      return { headline: "Acknowledgement report viewed", Icon: FileBarChart };
    case "announcement.report_export":
      return { headline: "Acknowledgement report exported", Icon: FileBarChart };
    default:
      return { headline: `Announcement ${a.label}`, Icon: Megaphone };
  }
}

/**
 * Right-rail "Recent Activity" — reads existing AuditLog rows, no new table.
 * auditLogHref omitted on the franchisor page: there's no franchisor-facing
 * audit log route to link to (/admin/audit-log is KICK_ADMIN-only).
 */
export function RecentActivityCard({ activity, auditLogHref }: { activity: AnnouncementActivityRow[]; auditLogHref?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
        {auditLogHref && (
          <Link href={auditLogHref} className="text-xs font-medium text-status-info hover:underline">
            View All
          </Link>
        )}
      </div>
      {activity.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activity.map((a) => {
            const { headline, Icon } = present(a);
            return (
              <li key={a.id} className="flex items-start gap-2.5 text-xs">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{headline}</span>
                  {a.entityTitle && <span className="block truncate text-muted-foreground">{a.entityTitle}</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
