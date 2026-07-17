"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { createTask } from "@/server/modules/tasks/service";
import { HttpError } from "@/server/modules/identity/errors";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  details: z.string().max(20_000).optional(),
  dueAt: z.string().optional(),
  locationIds: z.array(z.string().uuid()).min(1, "Select at least one store"),
});

function parse(formData: FormData) {
  return createSchema.parse({
    title: formData.get("title"),
    details: (formData.get("details") as string) || undefined,
    dueAt: (formData.get("dueAt") as string) || undefined,
    locationIds: formData.getAll("locationIds").map(String),
  });
}

export async function createTaskAction(formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = parse(formData);
  const task = await createTask(ctx, ctx.tenantId, {
    title: input.title,
    details: input.details ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    locationIds: input.locationIds,
  });
  revalidatePath("/franchisor/tasks");
  redirect(`/franchisor/tasks/${task.id}`);
}

/** Update title/details/dueAt (assignments are managed separately). */
export async function updateTaskAction(id: string, formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const title = String(formData.get("title") ?? "").trim();
  const details = (formData.get("details") as string) || null;
  const dueAtRaw = (formData.get("dueAt") as string) || "";
  if (!title) throw new HttpError(400, "Title is required");

  await withTenant(ctx, async (tx) => {
    const t = await tx.task.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!t) throw new HttpError(404, "Task not found");
    const after = await tx.task.update({ where: { id }, data: { title, details, dueAt: dueAtRaw ? new Date(dueAtRaw) : null } });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "task.update", entity: "Task", entityId: id, before: { title: t.title }, after: { title: after.title } });
  });
  revalidatePath("/franchisor/tasks");
  revalidatePath(`/franchisor/tasks/${id}`);
  redirect(`/franchisor/tasks/${id}`);
}

/** Send a reminder for a task's open assignments (records audit; delivery is handled by the worker). */
export async function sendReminderAction(id: string) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  await withTenant(ctx, async (tx) => {
    const t = await tx.task.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { assignments: { where: { status: "OPEN" } } } });
    if (!t) throw new HttpError(404, "Task not found");
    const now = new Date();
    await tx.taskAssignment.updateMany({ where: { taskId: id, status: "OPEN" }, data: { reminderSentAt: now } });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "task.reminder_sent", entity: "Task", entityId: id, after: { openAssignments: t.assignments.length } });
  });
  revalidatePath(`/franchisor/tasks/${id}`);
}
