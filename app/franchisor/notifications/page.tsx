import { Bell, AlertTriangle, Megaphone, Clock, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getFranchisorDashboard } from "@/server/modules/franchisor-dashboard/service";
import { PageHeader, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

const ICON: Record<string, LucideIcon> = {
  overdue_tasks: AlertTriangle,
  unread_announcement: Megaphone,
  onboarding_inactivity: Clock,
  push_failure: Bell,
  system: CheckCircle2,
};

export default async function FranchisorNotificationsPage() {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const data = await getFranchisorDashboard(ctx, {});

  return (
    <div>
      <PageHeader title="Notifications" description="Alerts and signals that need your attention." />
      {data.notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." icon={Bell} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.notifications.map((n) => {
            const Icon = ICON[n.category] ?? Bell;
            return (
              <li key={n.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
