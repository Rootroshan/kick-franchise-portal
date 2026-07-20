"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Megaphone, ClipboardList, ListChecks, Images, Info, Check, CheckCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markReadAction, markAllReadAction } from "@/app/admin/notifications/actions";

export type InboxRow = {
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
  ONBOARDING: ListChecks,
  ARTWORK: Images,
  SYSTEM: Info,
};

/**
 * Notification inbox. Opening a message marks it read, which decrements the
 * sidebar badge — the behaviour the old operational-signals panel could not
 * provide because it had no read state.
 */
export function NotificationInbox({ items }: { items: InboxRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const unread = items.filter((i) => !i.readAt).length;

  const open = (row: InboxRow) => {
    start(async () => {
      try {
        if (!row.readAt) await markReadAction(row.id);
        if (row.href) router.push(row.href);
        else router.refresh();
      } catch {
        toast.error("Couldn't open that notification");
      }
    });
  };

  const readAll = () => {
    start(async () => {
      try {
        const n = await markAllReadAction();
        toast.success(n > 0 ? `Marked ${n} as read` : "Nothing unread");
        router.refresh();
      } catch {
        toast.error("Couldn't mark all as read");
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Bell className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold">You&apos;re all caught up</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Notifications appear here when announcements are published, tasks are assigned, or the platform needs your attention.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All read"}
        </span>
        <button
          onClick={readAll}
          disabled={pending || unread === 0}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const Icon = ICON[n.category] ?? Bell;
          const isUnread = !n.readAt;
          return (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                disabled={pending}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                  isUnread ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
                )}
              >
                <span className={cn("mt-0.5 shrink-0", isUnread ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>{n.title}</span>
                    {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  {n.body && <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </span>
                {!isUnread && <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-label="Read" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
