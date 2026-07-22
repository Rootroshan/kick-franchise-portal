import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { deriveTaskState, type TaskDisplayState } from "@/lib/taskState";
import type { FranchiseeAssignmentRow } from "@/server/modules/tasks/service";
import { TaskStateBadge } from "@/components/franchisee/tasks/TaskCards";

const URGENCY: Record<TaskDisplayState, number> = { overdue: 0, due_today: 1, upcoming: 2, completed: 3 };

/**
 * Feed-page task summary: real per-location counts (each linking to the
 * filtered Tasks page) plus the most urgent open assignments — overdue first,
 * then due today, then upcoming.
 */
export function DashboardTasksCard({ assignments }: { assignments: FranchiseeAssignmentRow[] }) {
  const now = new Date();
  const items = assignments.map((a) => ({ ...a, state: deriveTaskState(a.status, a.dueAt, now) }));

  const stats = [
    { label: "Open", tab: "open", value: items.filter((t) => t.state !== "completed").length, className: "text-status-info" },
    { label: "Due Today", tab: "due_today", value: items.filter((t) => t.state === "due_today").length, className: "text-status-warning" },
    { label: "Overdue", tab: "overdue", value: items.filter((t) => t.state === "overdue").length, className: "text-status-error" },
    { label: "Completed", tab: "completed", value: items.filter((t) => t.state === "completed").length, className: "text-status-success" },
  ];

  const urgent = items
    .filter((t) => t.state !== "completed")
    .sort((a, b) => URGENCY[a.state] - URGENCY[b.state] || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Tasks</CardTitle>
        <Link href="/tasks" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <Link key={s.label} href={`/tasks?tab=${s.tab}`} className="rounded-lg bg-muted/50 p-2 text-center hover:bg-muted">
              <span className={`block text-lg font-bold leading-tight ${s.className}`}>{s.value}</span>
              <span className="block text-[11px] text-muted-foreground">{s.label}</span>
            </Link>
          ))}
        </div>

        {urgent.length > 0 && (
          <ul className="flex flex-col">
            {urgent.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{t.dueAt ? `Due ${formatDate(t.dueAt)}` : "No due date"}</span>
                  </span>
                  <TaskStateBadge state={t.state} dueAt={t.dueAt} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
