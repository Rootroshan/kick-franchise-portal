import { ClipboardList, AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listTasksAdmin, getTaskKpis } from "@/server/modules/tasks/admin";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { TaskRow } from "@/server/modules/tasks/admin";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions] = await Promise.all([
    listTasksAdmin(ctx, q),
    getTaskKpis(ctx),
    getBrandFilterOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<TaskRow>[] = [
    {
      key: "title",
      header: "Task",
      sortKey: "title",
      cell: (t) => (
        <div>
          <div className="font-medium text-foreground">{t.title}</div>
          <div className="text-xs text-muted-foreground">{t.brandName}</div>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      cell: (t) => {
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
      cell: (t) => (
        <span className={t.isOverdue ? "font-medium text-status-error" : "text-muted-foreground"}>
          {t.dueAt ? t.dueAt.toLocaleDateString() : "No due date"}
          {t.isOverdue && " · Overdue"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Tasks" description="Operational tasks across all brands, with per-store completion progress." />

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

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        basePath="/admin/tasks"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No tasks found", description: q.search || q.brand || q.status ? "Try different filters." : "Tasks from all brands appear here." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} task{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/tasks", q.raw, { page: p })} />
      </div>
    </div>
  );
}
