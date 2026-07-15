import { requireRole } from "@/server/modules/identity/guard";
import { listTasks } from "@/server/modules/tasks/service";
import { listLocations } from "@/server/modules/tenants/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TasksPanel } from "@/components/franchisor/TasksPanel";

export default async function TasksPage() {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const tenantId = ctx.tenantId!;

  const [tasks, locations] = await Promise.all([listTasks(ctx, tenantId), listLocations(ctx, tenantId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Assign checklist tasks to one or more locations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TasksPanel
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            initialTasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              details: t.details,
              dueAt: t.dueAt ? t.dueAt.toISOString() : null,
              assignmentCount: t.assignments.length,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
