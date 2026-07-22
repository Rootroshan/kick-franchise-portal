import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { TaskDisplayState } from "@/lib/taskState";

/**
 * Server-rendered pieces of the Store User tasks page. Only the toolbar needs
 * client JS — rows, cards and the progress donut are plain markup, so the
 * page stays light and every count is real server-derived data.
 */

export type TaskListItem = {
  id: string; // TaskAssignment id — Store User navigation is always by assignment
  title: string;
  details: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  state: TaskDisplayState;
};

export type TaskCounts = { total: number; open: number; dueToday: number; overdue: number; completed: number };

const STATE_META: Record<
  TaskDisplayState,
  { icon: LucideIcon; indicator: string; iconWrap: string; label: string | null; labelClass: string }
> = {
  overdue: {
    icon: AlertTriangle,
    indicator: "bg-status-error",
    iconWrap: "bg-status-error/10 text-status-error",
    label: "Overdue",
    labelClass: "text-status-error",
  },
  due_today: {
    icon: Calendar,
    indicator: "bg-status-warning",
    iconWrap: "bg-status-warning/10 text-status-warning",
    label: "Due today",
    labelClass: "text-status-warning",
  },
  upcoming: {
    icon: FileText,
    indicator: "bg-status-info",
    iconWrap: "bg-status-info/10 text-status-info",
    label: null,
    labelClass: "",
  },
  completed: {
    icon: CheckCircle2,
    indicator: "bg-status-success",
    iconWrap: "bg-status-success/10 text-status-success",
    label: null,
    labelClass: "text-status-success",
  },
};

export function TaskStateBadge({ state, dueAt }: { state: TaskDisplayState; dueAt: Date | null }) {
  if (state === "completed") return <Badge variant="success">Completed</Badge>;
  if (state === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  if (state === "due_today") return <Badge variant="warning">Due today</Badge>;
  return <Badge variant="secondary">{dueAt ? `Due ${formatDate(dueAt)}` : "Open"}</Badge>;
}

/** Clickable summary cards. Each card filters the list via the tab param. */
export function TaskSummaryCards({ counts, activeTab }: { counts: TaskCounts; activeTab: string }) {
  const cards: Array<{ tab: string; label: string; value: number; icon: LucideIcon; iconWrap: string }> = [
    { tab: "", label: "Total Tasks", value: counts.total, icon: ClipboardList, iconWrap: "bg-primary/10 text-primary" },
    { tab: "open", label: "Open", value: counts.open, icon: FileText, iconWrap: "bg-status-info/10 text-status-info" },
    { tab: "due_today", label: "Due Today", value: counts.dueToday, icon: Calendar, iconWrap: "bg-status-warning/10 text-status-warning" },
    { tab: "overdue", label: "Overdue", value: counts.overdue, icon: AlertTriangle, iconWrap: "bg-status-error/10 text-status-error" },
    { tab: "completed", label: "Completed", value: counts.completed, icon: CheckCircle2, iconWrap: "bg-status-success/10 text-status-success" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.tab ? `/tasks?tab=${c.tab}` : "/tasks"}
          aria-current={activeTab === c.tab ? "true" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40",
            activeTab === c.tab ? "border-primary" : "border-border"
          )}
        >
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", c.iconWrap)}>
            <c.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-bold leading-tight">{c.value}</span>
            <span className="block truncate text-xs text-muted-foreground">{c.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** One task row. The whole row links to the assignment's detail page. */
export function TaskRowCard({ task }: { task: TaskListItem }) {
  const meta = STATE_META[task.state];
  const Icon = meta.icon;
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", meta.indicator)} aria-hidden="true" />
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", meta.iconWrap)}>
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{task.title}</span>
        {task.details && <span className="block truncate text-sm text-muted-foreground">{task.details}</span>}
        {task.state === "completed" ? (
          <span className="block text-xs font-medium text-status-success">
            Completed{task.completedAt ? ` on ${formatDate(task.completedAt)}` : ""}
          </span>
        ) : meta.label ? (
          <span className={cn("block text-xs font-medium", meta.labelClass)}>{meta.label}</span>
        ) : null}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <TaskStateBadge state={task.state} dueAt={task.dueAt} />
        {task.dueAt && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> {formatDate(task.dueAt)}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Right-rail: next three OPEN assignments by due date. */
export function UpcomingTasksCard({ tasks }: { tasks: TaskListItem[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Upcoming tasks</h2>
        <Link href="/tasks?tab=open" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due soon.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.dueAt ? formatDate(t.dueAt) : "No due date"}</span>
                </span>
                <TaskStateBadge state={t.state} dueAt={t.dueAt} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Right-rail: completion donut from real assignment counts. */
export function TaskProgressCard({ counts }: { counts: TaskCounts }) {
  const pct = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);
  // Open in the legend = everything not yet completed and not urgent today.
  const openUpcoming = counts.open - counts.dueToday - counts.overdue;

  const R = 40;
  const C = 2 * Math.PI * R;
  const segments = [
    { value: counts.completed, className: "stroke-status-success" },
    { value: openUpcoming, className: "stroke-status-info" },
    { value: counts.dueToday, className: "stroke-status-warning" },
    { value: counts.overdue, className: "stroke-status-error" },
  ].filter((s) => s.value > 0);

  let offset = 0;
  const legend = [
    { label: "Completed", value: counts.completed, dot: "bg-status-success" },
    { label: "Open", value: openUpcoming, dot: "bg-status-info" },
    { label: "Due today", value: counts.dueToday, dot: "bg-status-warning" },
    { label: "Overdue", value: counts.overdue, dot: "bg-status-error" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Task progress</h2>
      {counts.total === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks yet — progress will appear once your store is assigned a task.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-muted" />
              {segments.map((s, i) => {
                const len = (s.value / counts.total) * C;
                const el = (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="butt"
                    className={s.className}
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{pct}%</span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">Completed</span>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-1.5 text-sm">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", l.dot)} aria-hidden="true" />
                <span className="flex-1 text-muted-foreground">{l.label}</span>
                <span className="font-medium tabular-nums">{l.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Guided empty state — shown when the store has no assignments at all. */
export function TasksEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ClipboardCheck className="h-7 w-7" />
      </span>
      <div>
        <h2 className="font-semibold">No tasks assigned</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your store has no open tasks right now.</p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Return to Feed
        </Link>
        <Link href="/tasks" className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Link>
      </div>
    </div>
  );
}
