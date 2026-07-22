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
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - summary.percent / 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold">Acknowledgement Summary</h2>
      <p className="mb-3 truncate text-xs text-muted-foreground" title={announcementTitle}>
        {announcementTitle}
      </p>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="stroke-violet-500"
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold tabular-nums leading-none">{summary.percent}%</span>
            <span className="text-[9px] text-muted-foreground">Acknowledged</span>
          </span>
        </div>
        <dl className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Total Users</dt>
            <dd className="font-semibold tabular-nums">{summary.totalEligibleUsers}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Acknowledged</dt>
            <dd className="font-semibold tabular-nums">{summary.acknowledgedUsers}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Pending</dt>
            <dd className="font-semibold tabular-nums">{summary.pendingUsers}</dd>
          </div>
        </dl>
      </div>
      <Link
        href={reportHref}
        className="mt-4 flex h-9 w-full items-center justify-center rounded-md border border-border bg-muted/50 text-xs font-medium hover:bg-muted"
      >
        View Full Report
      </Link>
    </div>
  );
}
