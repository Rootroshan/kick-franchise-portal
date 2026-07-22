import Link from "next/link";
import { KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { Users, CheckCircle2, Clock } from "lucide-react";
import type { AnnouncementAckUserRow, AcknowledgementSummary } from "@/server/modules/announcements/service";
import { ExportCsvButton } from "@/app/franchisor/announcements/[id]/report/ExportCsvButton";

type ReportData = {
  tenantId: string;
  title: string;
  totalLocations: number;
  acknowledgedCount: number;
  locations: Array<{ locationId: string; locationName: string; acknowledged: boolean }>;
};

/**
 * Shared acknowledgement-report body — used by both the franchisor page
 * (own tenant) and the admin page (any tenant, tenantId passed explicitly).
 * Keeping this as one component avoids duplicating the same JSX in both
 * route trees.
 */
export function AcknowledgementReportView({
  announcementId,
  announcementTitle,
  tenantId,
  report,
  summary,
  users,
  locationOptions,
  backHref,
  pagination,
}: {
  announcementId: string;
  announcementTitle: string;
  /** Explicit tenantId for KICK_ADMIN cross-tenant callers; omit for FRANCHISOR_ADMIN (own tenant, RLS-scoped). */
  tenantId?: string;
  report: ReportData;
  /** Tenant-wide (not just current page) acknowledged/pending counts — the KPI row must reflect the full filtered set, not one page. */
  summary: AcknowledgementSummary;
  users: { rows: AnnouncementAckUserRow[]; total: number };
  locationOptions: Array<{ value: string; label: string }>;
  backHref: string;
  pagination: { page: number; pageCount: number; makeHref: (p: number) => string };
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Acknowledgement Report</h1>
          <p className="text-sm text-muted-foreground">{announcementTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton announcementId={announcementId} tenantId={tenantId} fileName={`acknowledgements-${announcementId}.csv`} />
          <Link href={backHref} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            Back to announcements
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KPIStatCard label="Total Users" value={summary.totalEligibleUsers} icon={Users} tone="info" />
        <KPIStatCard label="Acknowledged" value={summary.acknowledgedUsers} sub={`${summary.percent}%`} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Pending" value={summary.pendingUsers} icon={Clock} tone="warning" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="text-sm font-semibold">Per-user breakdown</h2>
          <div className="min-w-[260px]">
            <ListToolbar searchPlaceholder="Search name or email…" filters={[{ key: "locationId", label: "Store", options: locationOptions }]} />
          </div>
        </div>
        <div className="scrollbar-hide overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Store</th>
                <th className="px-4 py-2.5 font-medium">Read</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Acknowledged</th>
              </tr>
            </thead>
            <tbody>
              {users.rows.map((u) => (
                <tr key={u.clerkUserId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{u.displayName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.locationName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {u.readAt ? u.readAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unread"}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={u.pending ? "pending" : "verified"} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.acknowledgedAt ? u.acknowledgedAt.toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {users.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border p-4">
          <p className="text-xs text-muted-foreground">{users.total} user{users.total === 1 ? "" : "s"}</p>
          <Pagination page={pagination.page} pageCount={pagination.pageCount} makeHref={pagination.makeHref} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Per-location summary</h2>
        <p className="mb-3 text-xs text-muted-foreground">{report.acknowledgedCount} of {report.totalLocations} locations acknowledged.</p>
        <ul className="flex flex-col gap-2">
          {report.locations.map((l) => (
            <li key={l.locationId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{l.locationName}</span>
              <StatusBadge status={l.acknowledged ? "verified" : "pending"} />
            </li>
          ))}
          {report.locations.length === 0 && <p className="text-sm text-muted-foreground">No locations yet.</p>}
        </ul>
      </div>
    </div>
  );
}
