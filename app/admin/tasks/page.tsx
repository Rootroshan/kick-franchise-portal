import { ClipboardList, AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listTasksAdmin, getTaskKpis } from "@/server/modules/tasks/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { Plus } from "lucide-react";
import { PageHeader, KPIStatCard, Pagination, PrimaryButtonLink } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTableSection } from "@/components/admin/DataTableSection";
import type { TaskRow } from "@/server/modules/tasks/admin";
import type { BulkActionDef } from "@/components/admin/bulk/BulkActionToolbar";
import { bulkDeleteTasksAction } from "./taskActions";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const TASK_ACTIONS: BulkActionDef[] = [
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    tone: "destructive",
    confirmTitle: "Delete selected tasks?",
    confirmMessage: "This removes the task and all its assignments. Store progress data is preserved.",
    action: bulkDeleteTasksAction,
  },
];

export default async function TasksPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listTasksAdmin(ctx, q),
    getTaskKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns = [
    {
      key: "title",
      header: "Task",
      sortKey: "title",
      cell: (t: TaskRow) => (
        <div>
          <div className="font-medium text-foreground">{t.title}</div>
          <div className="text-xs text-muted-foreground">{t.brandName}</div>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      cell: (t: TaskRow) => {
        const pct = t.total === 0 ? 0 : Math.round((t.completed / t.total) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${pct === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{t.completed}/{t.total}</span>
          </div>
        );
      },
    },
    {
      key: "due",
      header: "Due",
      sortKey: "dueAt",
      hideOnMobile: true,
      cell: (t: TaskRow) => (
        <span className={t.isOverdue ? "font-medium text-status-error" : "text-muted-foreground"}>
          {t.dueAt ? t.dueAt.toLocaleDateString() : "No due date"}
          {t.isOverdue && " · Overdue"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Operational tasks across all brands, with per-store completion progress."
        action={<PrimaryButtonLink href="/admin/tasks/new"><Plus className="h-4 w-4" /> New Task</PrimaryButtonLink>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Tasks" value={kpis.total} icon={ClipboardList} tone="info" />
        <KPIStatCard label="Open" value={kpis.open} icon={CircleDot} tone="warning" />
        <KPIStatCard label="Overdue" value={kpis.overdue} icon={AlertTriangle} tone="error" />
        <KPIStatCard label="Completed" value={kpis.completed} icon={CheckCircle2} tone="success" />
      </div>

      <ListToolbar
        searchPlaceholder="Search tasks…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "open", label: "Open" },
              { value: "overdue", label: "Overdue" },
              { value: "completed", label: "Completed" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {q.search || q.brand || q.status ? "No tasks match your filters." : "Tasks from all brands appear here."}
        </div>
      ) : (
        <DataTableSection
          rows={rows}
          columns={columns}
          rowKey={(t) => t.id}
          basePath="/admin/tasks"
          currentParams={q.raw}
          sort={q.sort}
          direction={q.direction}
          empty={{ title: "No tasks found", description: q.search || q.brand || q.status ? "Try different filters." : "Tasks from all brands appear here." }}
          actions={TASK_ACTIONS}
          itemName="task"
          total={total}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} task{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/tasks", q.raw, { page: p })} />
      </div>
    </div>
  );
}
