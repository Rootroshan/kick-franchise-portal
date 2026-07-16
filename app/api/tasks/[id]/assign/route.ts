import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { writeAuditLog } from "@/server/modules/identity/audit";

const assignSchema = z.object({ locationIds: z.array(z.string().uuid()).min(1).max(500) });

/** [K,F]: assign an existing task to additional locations. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const taskId = parts[parts.length - 2]!; // .../tasks/:id/assign
  const input = await parseJsonBody(req, assignSchema);

  const assignments = await withTenant(ctx, async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task) throw new HttpError(404, "Task not found");
    if (ctx.role !== "KICK_ADMIN" && task.tenantId !== ctx.tenantId) throw new HttpError(404, "Task not found");

    const locations = await tx.location.findMany({ where: { id: { in: input.locationIds }, tenantId: task.tenantId } });
    if (locations.length !== input.locationIds.length) {
      throw new HttpError(422, "One or more locations do not belong to this tenant");
    }

    const created = await Promise.all(
      locations.map((l) =>
        tx.taskAssignment.upsert({
          where: { taskId_locationId: { taskId, locationId: l.id } },
          create: { taskId, locationId: l.id },
          update: {},
        })
      )
    );

    await writeAuditLog(tx, {
      tenantId: task.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "task.assign",
      entity: "Task",
      entityId: taskId,
      after: { addedLocationIds: input.locationIds },
    });

    return created;
  });

  return Response.json({ assignments }, { status: 201 });
});
