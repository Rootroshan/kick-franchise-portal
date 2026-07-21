import Link from "next/link";
import type { AcknowledgementSummary } from "@/server/modules/announcements/service";

/**
 * Right-rail "Acknowledgement Summary" — scoped to one specific announcement
 * (the caller picks which; see the list pages for how they choose one),
 * since getAcknowledgementSummary's brand-wide mode (announcementId omitted)
 * has no denominator-independent "acknowledged" count to show on a list page
 * — every requiresAck announcement has its own audience/ack set. Plain SVG
 * ring, no chart lib: one static percentage doesn't need a client boundary.
 */
export function AcknowledgementSummaryCard({
  summary,
  announcementTitle,
  reportHref,
}: {
  summary: AcknowledgementSummary;
  announcementTitle: string;
  reportHref: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - summary.percent / 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold">Acknowledgement Summary</h2>
      <p className="mb-3 truncate text-xs text-muted-foreground" title={announcementTitle}>
        {announcementTitle}
      </p>
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-muted" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="stroke-status-success"
          />
        </svg>
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="text-lg font-bold tabular-nums">{summary.percent}%</span>
          <span className="text-xs text-muted-foreground">
            {summary.acknowledgedUsers} of {summary.totalEligibleUsers} acknowledged
          </span>
          <span className="text-xs text-muted-foreground">{summary.pendingUsers} pending</span>
        </div>
      </div>
      <Link
        href={reportHref}
        className="mt-3 inline-flex items-center text-xs font-medium text-status-info hover:underline"
      >
        View full report →
      </Link>
    </div>
  );
}
