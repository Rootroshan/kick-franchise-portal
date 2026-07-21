import Link from "next/link";
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
  return date.toLocaleDateString();
}

/**
 * Right-rail "Recent Activity" — reads existing AuditLog rows, no new table.
 * auditLogHref omitted on the franchisor page: there's no franchisor-facing
 * audit log route to link to (/admin/audit-log is KICK_ADMIN-only).
 */
export function RecentActivityCard({ activity, auditLogHref }: { activity: AnnouncementActivityRow[]; auditLogHref?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">Recent Activity</h2>
      {activity.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-foreground">
                Announcement <span className="font-medium">{a.label}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">{timeAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {auditLogHref && (
        <Link href={auditLogHref} className="mt-3 inline-flex items-center text-xs font-medium text-status-info hover:underline">
          View all activity →
        </Link>
      )}
    </div>
  );
}
