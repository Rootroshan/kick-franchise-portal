import { requireRole, requireTenantRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createTask, listTasks } from "@/server/modules/tasks/service";
import { createTaskSchema } from "@/server/modules/tasks/schemas";

/** [K,F,U]: list tasks (franchisee scoped to own location). */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const tasks = await listTasks(ctx, ctx.tenantId);
  return Response.json({ tasks });
});

/** [K,F]: create + assign a task to one or more locations. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireTenantRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, createTaskSchema);
  const task = await createTask(ctx, ctx.tenantId, input);
  return Response.json({ task }, { status: 201 });
});
