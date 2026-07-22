"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { createTask } from "@/server/modules/tasks/service";

const createAdminSchema = z.object({
  tenantId: z.string().uuid("Pick a brand"),
  title: z.string().min(1, "Title is required").max(300),
  details: z.string().max(20_000).optional(),
  dueAt: z.string().optional(),
  locationIds: z.array(z.string().uuid()).min(1, "Select at least one store"),
});

/**
 * KICK_ADMIN creates a task for any brand. The browser-submitted tenantId is
 * only trusted as a *selection* — createTask re-verifies every store belongs
 * to that tenant, creates Task + one TaskAssignment per store in one
 * transaction, audits, and fans out in-app + push notifications.
 */
export async function createTaskAdminAction(formData: FormData) {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = createAdminSchema.parse({
    tenantId: formData.get("tenantId"),
    title: formData.get("title"),
    details: (formData.get("details") as string) || undefined,
    dueAt: (formData.get("dueAt") as string) || undefined,
    locationIds: formData.getAll("locationIds").map(String),
  });

  await createTask(ctx, input.tenantId, {
    title: input.title,
    details: input.details ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    locationIds: input.locationIds,
  });
  revalidatePath("/admin/tasks");
  redirect("/admin/tasks");
}

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

export async function bulkDeleteTasksAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No tasks selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const task = await tx.task.findUnique({ where: { id } });
        if (!task) throw new HttpError(404, "Task not found");
        await tx.task.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            tenantId: task.tenantId,
            actorId: ctx.userId,
            role: ctx.role,
            action: "task.delete",
            entity: "Task",
            entityId: id,
            before: { title: task.title },
          },
        });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/tasks");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} task${ok === 1 ? "" : "s"} deleted.` };
  if (ok === 0) return { ok: false, message: `Could not delete ${fail} task${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} deleted, ${fail} failed.` };
}
