import Link from "next/link";
import { Bell, CheckCircle2, Clock, AlertTriangle, ClipboardList, Megaphone } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getNotificationsOverview } from "@/server/modules/notifications/admin";
import { PageHeader, KPIStatCard, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const data = await getNotificationsOverview(ctx);

  return (
    <div>
      <PageHeader title="Notifications" description="Push-delivery health and operational signals that need attention across the platform." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Subscriptions" value={data.subs.total} icon={Bell} tone="info" />
        <KPIStatCard label="Delivering" value={data.subs.sent} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Pending" value={data.subs.pending} icon={Clock} tone="warning" />
        <KPIStatCard label="Failed" value={data.subs.failed} icon={AlertTriangle} tone="error" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Needs Attention</h2>
          <div className="flex flex-col gap-2">
            <SignalRow icon={ClipboardList} label="Overdue tasks" value={data.signals.overdueTasks} href="/admin/tasks?status=overdue" tone="error" />
            <SignalRow icon={Megaphone} label="Scheduled announcements" value={data.signals.scheduledAnnouncements} href="/admin/announcements?status=SCHEDULED" tone="info" />
            <SignalRow icon={Bell} label="Awaiting acknowledgement" value={data.signals.pendingAckAnnouncements} href="/admin/announcements" tone="warning" />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent Push Failures</h2>
          {data.recentFailures.length === 0 ? (
            <EmptyState title="No delivery failures" description="All push notifications are delivering successfully." icon={CheckCircle2} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {data.recentFailures.map((f) => (
                <div key={f.id} className="border-b border-border px-3 py-2.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs" title={f.endpoint}>{f.endpoint.replace(/^https?:\/\//, "").slice(0, 40)}…</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{f.updatedAt.toLocaleDateString()}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-status-error">{f.lastError ?? "Unknown error"}</div>
                  {f.brandName && <div className="text-xs text-muted-foreground">{f.brandName}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
  tone: "error" | "warning" | "info";
}) {
  const toneCls = { error: "text-status-error", warning: "text-status-warning", info: "text-status-info" }[tone];
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted">
      <span className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${value > 0 ? toneCls : "text-muted-foreground"}`} />
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${value > 0 ? toneCls : "text-muted-foreground"}`}>{value}</span>
    </Link>
  );
}
