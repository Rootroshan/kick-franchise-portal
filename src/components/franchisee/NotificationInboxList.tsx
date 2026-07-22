"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell, Megaphone, ClipboardList, Package, Image as ImageIcon, Info, ChevronRight, CheckCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/(franchisee)/notifications/actions";

export type InboxListItem = {
  id: string;
  category: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const ICON: Record<string, LucideIcon> = {
  ANNOUNCEMENT: Megaphone,
  TASK: ClipboardList,
  ONBOARDING: ClipboardList,
  ARTWORK: ImageIcon,
  ORDER: Package,
  SYSTEM: Info,
};

const TONE: Record<string, string> = {
  ANNOUNCEMENT: "text-status-info",
  TASK: "text-status-warning",
  ONBOARDING: "text-status-info",
  ARTWORK: "text-status-info",
  ORDER: "text-status-success",
  SYSTEM: "text-muted-foreground",
};

/**
 * Persisted notification inbox. Opening an item marks it read (clearing the
 * badge) and then navigates to its target — order, announcement, task, etc.
 */
export function NotificationInboxList({ items, unreadCount }: { items: InboxListItem[]; unreadCount: number }) {
  const router = useRouter();
  const [, start] = useTransition();

  function open(item: InboxListItem) {
    start(async () => {
      if (!item.readAt) await markNotificationReadAction(item.id).catch(() => undefined);
      if (item.href) router.push(item.href);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => start(async () => markAllNotificationsReadAction().catch(() => undefined))}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all read
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const Icon = ICON[n.category] ?? Bell;
          const unread = !n.readAt;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted",
                  unread ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", TONE[n.category] ?? "text-muted-foreground")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", unread && "font-semibold")}>{n.title}</p>
                  {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
