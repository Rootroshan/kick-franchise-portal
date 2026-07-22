import { CheckCircle2 } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listFranchiseeAssignments } from "@/server/modules/tasks/service";
import { deriveTaskState, TASK_TABS, TASK_SORTS, type TaskTab, type TaskSort } from "@/lib/taskState";
import { TasksToolbar } from "@/components/franchisee/tasks/TasksToolbar";
import {
  TaskSummaryCards,
  TaskRowCard,
  UpcomingTasksCard,
  TaskProgressCard,
  TasksEmptyState,
  type TaskListItem,
} from "@/components/franchisee/tasks/TaskCards";

export const dynamic = "force-dynamic";

const TAB_EMPTY_COPY: Record<Exclude<TaskTab, "">, string> = {
  open: "No open tasks — you're all caught up.",
  due_today: "Nothing due today.",
  overdue: "No overdue tasks. Nice work.",
  completed: "No completed tasks yet.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { tab?: string; sort?: string; q?: string };
}) {
  // Location scoping happens in the service: only THIS store's assignments
  // are ever fetched, so every count below is real per-location data.
  const ctx = await requireRole("FRANCHISEE_USER")();
  const rows = await listFranchiseeAssignments(ctx);

  const now = new Date();
  const all: TaskListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    details: r.details,
    dueAt: r.dueAt,
    completedAt: r.completedAt,
    state: deriveTaskState(r.status, r.dueAt, now),
  }));

  const counts = {
    total: all.length,
    open: all.filter((t) => t.state !== "completed").length,
    dueToday: all.filter((t) => t.state === "due_today").length,
    overdue: all.filter((t) => t.state === "overdue").length,
    completed: all.filter((t) => t.state === "completed").length,
  };

  const tab: TaskTab = TASK_TABS.some((t) => t.value === searchParams.tab) ? (searchParams.tab as TaskTab) : "";
  const sort: TaskSort = TASK_SORTS.some((s) => s.value === searchParams.sort) ? (searchParams.sort as TaskSort) : "";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  // ponytail: filter/sort in memory — one store's assignment list is small,
  // same pattern as the announcements feed; no extra queries per tab.
  let feed = all;
  if (tab === "open") feed = feed.filter((t) => t.state !== "completed");
  else if (tab === "due_today") feed = feed.filter((t) => t.state === "due_today");
  else if (tab === "overdue") feed = feed.filter((t) => t.state === "overdue");
  else if (tab === "completed") feed = feed.filter((t) => t.state === "completed");
  if (q) feed = feed.filter((t) => t.title.toLowerCase().includes(q) || (t.details ?? "").toLowerCase().includes(q));

  feed = [...feed].sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const at = rows.find((r) => r.id === a.id)!.createdAt.getTime();
      const bt = rows.find((r) => r.id === b.id)!.createdAt.getTime();
      return sort === "newest" ? bt - at : at - bt;
    }
    if (sort === "completed") {
      return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
    }
    // Default: due date ascending, no-due-date last, completed after open.
    if ((a.state === "completed") !== (b.state === "completed")) return a.state === "completed" ? 1 : -1;
    return (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
  });

  const upcoming = all
    .filter((t) => t.state !== "completed")
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">View and complete tasks assigned to your store.</p>
      </div>

      {all.length === 0 ? (
        <TasksEmptyState />
      ) : (
        <>
          <TaskSummaryCards counts={counts} activeTab={tab} />
          <TasksToolbar tab={tab} sort={sort} q={searchParams.q ?? ""} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-3 lg:col-span-2">
              {feed.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {q ? "No tasks match your search." : tab ? TAB_EMPTY_COPY[tab as Exclude<TaskTab, "">] : "No tasks found."}
                </p>
              ) : (
                <>
                  {feed.map((t) => (
                    <TaskRowCard key={t.id} task={t} />
                  ))}
                  <p className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> No more tasks
                  </p>
                </>
              )}
            </div>

            {/* Rail sits right of the list on desktop, below it on mobile/tablet. */}
            <div className="flex flex-col gap-4 lg:col-span-1">
              <UpcomingTasksCard tasks={upcoming} />
              <TaskProgressCard counts={counts} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
