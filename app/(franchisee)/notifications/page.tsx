import { Bell } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listNotifications, getUnreadCount } from "@/server/modules/notifications/inbox";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationInboxList } from "@/components/franchisee/NotificationInboxList";

export const dynamic = "force-dynamic";

/**
 * Store User notification inbox — the persisted, per-user feed (announcement,
 * task, order, artwork events). Read-state lives on each row: opening an item
 * marks it read, which is what clears the top-bar badge. Replaces the old
 * live-derived signal list, which had no read concept so the badge never cleared.
 */
export default async function NotificationsPage() {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const [items, unreadCount] = await Promise.all([listNotifications(ctx, { limit: 50 }), getUnreadCount(ctx)]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Notifications</h1>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <NotificationInboxList
          unreadCount={unreadCount}
          items={items.map((n) => ({
            id: n.id,
            category: n.category,
            title: n.title,
            body: n.body,
            href: n.href,
            readAt: n.readAt ? n.readAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
