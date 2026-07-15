import { getRequestContext } from "@/server/modules/identity/requestContext";
import { listTasks } from "@/server/modules/tasks/service";
import { TaskList } from "@/components/franchisee/TaskList";

export default async function TasksPage() {
  const ctx = await getRequestContext();
  const tasks = await listTasks(ctx, ctx.tenantId!);

  const items = tasks.map((t) => {
    const assignment = t.assignments[0]; // franchisee query already scopes assignments to ctx.locationId
    return {
      taskId: t.id,
      assignmentId: assignment?.id ?? "",
      title: t.title,
      details: t.details,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      completed: assignment?.status === "COMPLETED",
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Tasks</h1>
      <TaskList tasks={items} />
    </div>
  );
}
