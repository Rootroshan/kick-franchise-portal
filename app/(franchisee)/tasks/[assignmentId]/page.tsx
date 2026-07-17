import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, AlertTriangle } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompleteTaskButton } from "@/components/franchisee/CompleteTaskButton";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { assignmentId: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();

  // Store isolation: the assignment must belong to the caller's own location.
  const assignment = await withTenant(ctx, (tx) =>
    tx.taskAssignment.findFirst({
      where: { id: params.assignmentId, locationId: ctx.locationId ?? undefined },
      include: { task: true },
    })
  );
  if (!assignment) notFound();

  const { task } = assignment;
  const completed = assignment.status === "COMPLETED";
  const overdue = !completed && !!task.dueAt && task.dueAt < new Date();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tasks
      </Link>

      <div className="flex items-start justify-between gap-2">
        <h1 className="text-lg font-semibold">{task.title}</h1>
        {completed ? <Badge variant="success">Completed</Badge> : overdue ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="warning">Open</Badge>}
      </div>

      {task.dueAt && (
        <div className={`inline-flex items-center gap-1.5 text-sm ${overdue ? "text-status-error" : "text-muted-foreground"}`}>
          {overdue ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
          Due {task.dueAt.toLocaleString()}
        </div>
      )}

      {task.details && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="whitespace-pre-wrap text-sm">{task.details}</p></CardContent>
        </Card>
      )}

      {completed && assignment.completedAt && (
        <p className="text-xs text-muted-foreground">Completed on {assignment.completedAt.toLocaleString()}</p>
      )}

      {/* Sticky bottom action on mobile */}
      <div className="sticky bottom-20 mt-2">
        <CompleteTaskButton assignmentId={assignment.id} completed={completed} />
      </div>
    </div>
  );
}
