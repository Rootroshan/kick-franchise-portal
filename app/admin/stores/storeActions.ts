"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";

export type ActionResult = { ok: boolean; message: string };

async function activateStore(ctx: RequestContext, id: string) {
  await withTenant(ctx, async (tx) => {
    const loc = await tx.location.findUnique({ where: { id } });
    if (!loc) throw new HttpError(404, "Store not found");
    await tx.location.update({ where: { id }, data: { status: "active" } });
    await tx.auditLog.create({
      data: {
        tenantId: loc.tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: "location.activate",
        entity: "Location",
        entityId: id,
        before: { status: loc.status },
        after: { status: "active" },
      },
    });
  });
}

async function deactivateStore(ctx: RequestContext, id: string) {
  await withTenant(ctx, async (tx) => {
    const loc = await tx.location.findUnique({ where: { id } });
    if (!loc) throw new HttpError(404, "Store not found");
    await tx.location.update({ where: { id }, data: { status: "inactive" } });
    await tx.auditLog.create({
      data: {
        tenantId: loc.tenantId,
        actorId: ctx.userId,
        role: ctx.role,
        action: "location.deactivate",
        entity: "Location",
        entityId: id,
        before: { status: loc.status },
        after: { status: "inactive" },
      },
    });
  });
}

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

export async function bulkActivateStoresAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No stores selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await activateStore(ctx, id);
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/stores");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} store${ok === 1 ? "" : "s"} activated.` };
  if (ok === 0) return { ok: false, message: `Could not activate ${fail} store${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} activated, ${fail} failed.` };
}

export async function bulkDeactivateStoresAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No stores selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await deactivateStore(ctx, id);
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/stores");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} store${ok === 1 ? "" : "s"} deactivated.` };
  if (ok === 0) return { ok: false, message: `Could not deactivate ${fail} store${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} deactivated, ${fail} failed.` };
}
