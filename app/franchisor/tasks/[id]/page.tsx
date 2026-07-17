import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorTask } from "@/server/modules/tasks/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader, StatusBadge } from "@/components/admin/kit";
import { TaskReminderButton } from "@/components/franchisor/tasks/TaskReminderButton";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let t;
  try {
    t = await getFranchisorTask(ctx, ctx.tenantId, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const completed = t.assignments.filter((a) => a.status === "COMPLETED").length;
  const openCount = t.assignments.length - completed;
  const pct = t.assignments.length === 0 ? 0 : Math.round((completed / t.assignments.length) * 100);
  const isOverdue = !!t.dueAt && t.dueAt < new Date() && completed < t.assignments.length;

  return (
    <div>
      <Link href="/franchisor/tasks" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <PageHeader
        title={t.title}
        description={t.dueAt ? `Due ${t.dueAt.toLocaleString()}` : "No due date"}
        secondaryAction={isOverdue ? <StatusBadge status="overdue" /> : <StatusBadge status={completed === t.assignments.length ? "completed" : "open"} />}
        action={
          <Link href={`/franchisor/tasks/${t.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TaskReminderButton id={t.id} openCount={openCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {t.details && (
            <div className="mb-4 rounded-xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold">Description</h2>
              <p className="whitespace-pre-wrap text-sm">{t.details}</p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Store Assignments ({completed}/{t.assignments.length})</h2>
            </div>
            <ul>
              {t.assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                  {a.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  <span className="flex-1 truncate text-sm">{a.storeName}</span>
                  {a.status === "COMPLETED" && a.completedAt ? (
                    <span className="text-xs text-muted-foreground">Done {a.completedAt.toLocaleDateString()}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Progress</h2>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{pct}%</span>
            <span className="text-sm text-muted-foreground">complete</span>
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${pct === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Completed</dt><dd className="font-medium">{completed}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Open</dt><dd className="font-medium">{openCount}</dd></div>
            {isOverdue && <div className="flex items-center gap-1 text-status-error"><AlertTriangle className="h-4 w-4" /> Overdue</div>}
          </dl>
        </div>
      </div>
    </div>
  );
}
