import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, Store } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { deriveTaskState } from "@/lib/taskState";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStateBadge } from "@/components/franchisee/tasks/TaskCards";
import { CompleteTaskButton } from "@/components/franchisee/CompleteTaskButton";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { assignmentId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Store isolation: the assignment must belong to the caller's own location
  // (plus RLS underneath). A guessed/foreign assignment id 404s — it never
  // reveals whether the id exists for another store.
  const assignment = await withTenant(ctx, (tx) =>
    tx.taskAssignment.findFirst({
      where: { id: params.assignmentId, locationId: ctx.locationId ?? undefined },
      include: { task: true, location: { select: { name: true } } },
    })
  );
  if (!assignment) notFound();

  const { task } = assignment;
  const state = deriveTaskState(assignment.status, task.dueAt);
  const completed = state === "completed";

  // "Completed by" is a clerk user id on the row; show the teammate's name
  // where a membership still exists for it.
  const completedByName = assignment.completedBy
    ? await withTenant(ctx, async (tx) => {
        const m = await tx.membership.findFirst({
          where: { clerkUserId: assignment.completedBy!, tenantId: task.tenantId },
          select: { displayName: true, email: true },
        });
        return m?.displayName ?? m?.email ?? null;
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <div className="flex items-start justify-between gap-2">
        <h1 className="text-lg font-semibold">{task.title}</h1>
        <TaskStateBadge state={state} dueAt={task.dueAt} />
      </div>

      {state === "overdue" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This task was due {task.dueAt ? formatDateTime(task.dueAt) : "earlier"} and is overdue. Complete it as soon as
            possible.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Store className="h-4 w-4" /> {assignment.location.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarPlus className="h-4 w-4" /> Created {formatDate(task.createdAt)}
        </span>
        {task.dueAt && (
          <span className={`inline-flex items-center gap-1.5 ${state === "overdue" ? "font-medium text-status-error" : ""}`}>
            <CalendarClock className="h-4 w-4" /> Due {formatDateTime(task.dueAt)}
          </span>
        )}
      </div>

      {task.details && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="whitespace-pre-wrap text-sm">{task.details}</p></CardContent>
        </Card>
      )}

      {completed && (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Completed{assignment.completedAt ? ` on ${formatDateTime(assignment.completedAt)}` : ""}
            {completedByName ? ` by ${completedByName}` : ""}.
          </p>
        </div>
      )}

      {/* Sticky bottom action on mobile */}
      <div className="sticky bottom-20 mt-2">
        <CompleteTaskButton assignmentId={assignment.id} completed={completed} />
      </div>
    </div>
  );
}
