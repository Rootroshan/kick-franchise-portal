import Link from "next/link";
import { Bell, Megaphone, ClipboardList, AlertTriangle, Package, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getStoreNotifications } from "@/server/modules/notifications/store";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ICON: Record<string, LucideIcon> = {
  announcement: Megaphone,
  task_due: ClipboardList,
  task_overdue: AlertTriangle,
  order: Package,
  onboarding: ClipboardList,
};
const TONE: Record<string, string> = {
  announcement: "text-status-info",
  task_due: "text-status-warning",
  task_overdue: "text-status-error",
  order: "text-status-success",
  onboarding: "text-status-info",
};

export default async function NotificationsPage() {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const notifications = await getStoreNotifications(ctx);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Notifications</h1>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const Icon = ICON[n.category] ?? Bell;
            return (
              <li key={n.id}>
                <Link href={n.href} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted">
                  <Icon className={`h-5 w-5 shrink-0 ${TONE[n.category] ?? "text-muted-foreground"}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
