"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { createAnnouncement } from "@/server/modules/announcements/service";
import { parseComposerForm } from "@/server/modules/announcements/schemas";
import { AnnouncementStatus } from "@prisma/client";

/**
 * KICK_ADMIN creates an announcement for any brand — brand picked in the
 * form, verified to exist. Status derived server-side from intent+mode:
 * SAVE_DRAFT → DRAFT, PUBLISH+NOW → PUBLISHED, PUBLISH+SCHEDULE → SCHEDULED.
 */
export async function createAnnouncementAdminAction(formData: FormData) {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = z.string().uuid("Pick a brand").parse(formData.get("tenantId"));
  const input = parseComposerForm(formData);

  const tenant = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }));
  if (!tenant) throw new HttpError(404, "Brand not found");

  await createAnnouncement(ctx, tenantId, {
    title: input.title,
    body: input.body,
    isPinned: input.isPinned,
    requiresAck: input.requiresAck,
    asDraft: input.intent === "SAVE_DRAFT",
    publishAt: input.publishMode === "SCHEDULE" && input.publishAt ? new Date(input.publishAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  revalidatePath("/admin/announcements");
  redirect("/admin/announcements");
}

export type ActionResult = { ok: boolean; message: string };

export async function toggleAnnouncementPinAction(id: string, pinned: boolean): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();
  try {
    await withTenant(ctx, async (tx) => {
      const ann = await tx.announcement.findUnique({ where: { id } });
      if (!ann) throw new HttpError(404, "Announcement not found");
      await tx.announcement.update({ where: { id }, data: { isPinned: pinned } });
      await tx.auditLog.create({
        data: {
          tenantId: ann.tenantId,
          actorId: ctx.userId,
          role: ctx.role,
          action: "announcement.update",
          entity: "Announcement",
          entityId: id,
          before: { isPinned: ann.isPinned },
          after: { isPinned: pinned },
        },
      });
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update." };
  }
  revalidatePath("/admin/announcements");
  return { ok: true, message: pinned ? "Pinned." : "Unpinned." };
}

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

async function bulkSetStatus(ids: string[], status: AnnouncementStatus, pastTense: string): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No announcements selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const ann = await tx.announcement.findUnique({ where: { id } });
        if (!ann) throw new HttpError(404, "Not found");
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
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/announcements");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} announcement${ok === 1 ? "" : "s"} ${pastTense}.` };
  if (ok === 0) return { ok: false, message: `Could not ${pastTense === "archived" ? "archive" : pastTense.slice(0, -1)} ${fail} announcement${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} ${pastTense}, ${fail} failed.` };
}

export async function bulkExpireAnnouncementsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, AnnouncementStatus.EXPIRED, "expired");
}

export async function bulkArchiveAnnouncementsAction(ids: string[]): Promise<BulkActionResult> {
  return bulkSetStatus(ids, AnnouncementStatus.ARCHIVED, "archived");
}

export async function bulkPinAnnouncementsAction(ids: string[]): Promise<BulkActionResult> {
  if (!ids.length) return { ok: false, message: "No announcements selected." };
  const ctx = await requireRole("KICK_ADMIN")();
  const results: Array<{ ok: boolean }> = [];

  for (const id of ids) {
    try {
      await withTenant(ctx, async (tx) => {
        const ann = await tx.announcement.findUnique({ where: { id } });
        if (!ann) throw new HttpError(404, "Not found");
        await tx.announcement.update({ where: { id }, data: { isPinned: true } });
        await tx.auditLog.create({
          data: {
            tenantId: ann.tenantId,
            actorId: ctx.userId,
            role: ctx.role,
            action: "announcement.update",
            entity: "Announcement",
            entityId: id,
            before: { isPinned: ann.isPinned },
            after: { isPinned: true },
          },
        });
      });
      results.push({ ok: true });
    } catch {
      results.push({ ok: false });
    }
  }

  revalidatePath("/admin/announcements");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  if (fail === 0) return { ok: true, message: `${ok} announcement${ok === 1 ? "" : "s"} pinned.` };
  if (ok === 0) return { ok: false, message: `Could not pin ${fail} announcement${fail === 1 ? "" : "s"}.` };
  return { ok: true, partial: true, message: `${ok} pinned, ${fail} failed.` };
}
