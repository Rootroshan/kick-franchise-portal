import Link from "next/link";
import { Plus, AlertTriangle, Eye, Pencil } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorTasks } from "@/server/modules/tasks/franchisorList";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, Pagination, PrimaryButtonLink, EmptyState } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { FilterTabs } from "@/components/franchisor/shared/FilterTabs";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const q = parseListQuery(searchParams);
  const { rows, total, counts } = await listFranchisorTasks(ctx, ctx.tenantId, q);
  const pages = pageCount(total, q.limit);

  const tabs = [
    { value: "", label: "All", count: counts.all },
    { value: "open", label: "Open", count: counts.open },
    { value: "completed", label: "Completed", count: counts.completed },
    { value: "overdue", label: "Overdue", count: counts.overdue },
    { value: "due_this_week", label: "Due This Week", count: counts.dueThisWeek },
  ];

  const pct = (r: { completed: number; total: number }) => (r.total === 0 ? 0 : Math.round((r.completed / r.total) * 100));

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Create and track tasks for your stores."
        action={<PrimaryButtonLink href="/franchisor/tasks/new"><Plus className="h-4 w-4" /> Create Task</PrimaryButtonLink>}
      />

      <FilterTabs tabs={tabs} />
      <ListToolbar searchPlaceholder="Search tasks…" />

      {rows.length === 0 ? (
        <EmptyState title="No tasks found" description={q.search || q.status ? "Try different filters." : "Create your first task for your stores."} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Task</th>
                  <th className="px-3 py-2.5 font-medium">Due Date</th>
                  <th className="px-3 py-2.5 font-medium">Progress</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{t.title}</td>
                    <td className="px-3 py-2.5">
                      <span className={t.isOverdue ? "font-medium text-status-error" : "text-muted-foreground"}>
                        {t.dueAt ? t.dueAt.toLocaleDateString() : "No due date"}
                        {t.isOverdue && <span className="ml-1 inline-flex items-center"><AlertTriangle className="h-3 w-3" /></span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${pct(t) === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct(t)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{t.completed}/{t.total} ({pct(t)}%)</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/franchisor/tasks/${t.id}`} className="rounded p-1.5 hover:bg-muted" aria-label="View"><Eye className="h-4 w-4" /></Link>
                        <Link href={`/franchisor/tasks/${t.id}/edit`} className="rounded p-1.5 hover:bg-muted" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((t) => (
              <li key={t.id}>
                <Link href={`/franchisor/tasks/${t.id}`} className="block rounded-xl border border-border bg-card p-3">
                  <div className="mb-1 font-medium">{t.title}</div>
                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${pct(t) === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct(t)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={t.isOverdue ? "font-medium text-status-error" : ""}>{t.dueAt ? t.dueAt.toLocaleDateString() : "No due date"}{t.isOverdue ? " · Overdue" : ""}</span>
                    <span>{t.completed}/{t.total} stores</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} task{total === 1 ? "" : "s"}</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/franchisor/tasks", q.raw, { page: p })} />
      </div>
    </div>
  );
}
