"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { AnnouncementStatus } from "@prisma/client";

export type ActionResult = { ok: boolean; message: string };

export async function setAnnouncementStatusAction(id: string, status: AnnouncementStatus): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await withTenant(ctx, async (tx) => {
      const ann = await tx.announcement.findUnique({ where: { id }, include: { tenant: true } });
      if (!ann) throw new HttpError(404, "Announcement not found");
      await tx.announcement.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          tenantId: ann.tenantId,
          actorId: ctx.userId,
          role: ctx.role,
          action: "announcement.status",
          entity: "Announcement",
          entityId: id,
          before: { status: ann.status },
          after: { status },
        },
      });
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update." };
  }
  revalidatePath("/admin/announcements");
  return { ok: true, message: "Announcement updated." };
}

export type BulkActionResult = { ok: boolean; message: string; partial?: boolean };

export async function bulkPublishAnnouncementsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No announcements selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const ann = await tx.announcement.findUnique({ where: { id } });
        if (!ann) throw new HttpError(404, "Not found");
        await tx.announcement.update({ where: { id }, data: { status: AnnouncementStatus.PUBLISHED } });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/announcements");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} announcement${ok === 1 ? "" : "s"} published.` };
  if (ok === 0) return { ok: false, message: `Could not publish ${fail} announcement${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} published, ${fail} failed.` };
}

export async function bulkDeleteAnnouncementsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No announcements selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const ann = await tx.announcement.findUnique({ where: { id } });
        if (!ann) throw new HttpError(404, "Not found");
        await tx.announcement.delete({ where: { id } });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/announcements");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} announcement${ok === 1 ? "" : "s"} deleted.` };
  if (ok === 0) return { ok: false, message: `Could not delete ${fail} announcement${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} deleted, ${fail} failed.` };
}
