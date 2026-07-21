"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";

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
