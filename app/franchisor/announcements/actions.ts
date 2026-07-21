"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { createAnnouncement, updateAnnouncement, getAllAnnouncementAcknowledgementUsers } from "@/server/modules/announcements/service";
import { HttpError } from "@/server/modules/identity/errors";
import { csvCell } from "@/lib/csv";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().min(1, "Body is required").max(20_000),
  isPinned: z.boolean().optional().default(false),
  requiresAck: z.boolean().optional().default(false),
  publishAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

function parseForm(formData: FormData) {
  return formSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    isPinned: formData.get("isPinned") === "on",
    requiresAck: formData.get("requiresAck") === "on",
    publishAt: (formData.get("publishAt") as string) || undefined,
    expiresAt: (formData.get("expiresAt") as string) || undefined,
  });
}

/** Create an announcement, then redirect to its detail page. */
export async function createAnnouncementAction(formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = parseForm(formData);
  const created = await createAnnouncement(ctx, ctx.tenantId, {
    title: input.title,
    body: input.body,
    isPinned: input.isPinned,
    requiresAck: input.requiresAck,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  revalidatePath("/franchisor/announcements");
  redirect(`/franchisor/announcements/${created.id}`);
}

export async function updateAnnouncementAction(id: string, formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = parseForm(formData);
  // Ownership check: the record must belong to this tenant.
  const owned = await withTenant(ctx, (tx) => tx.announcement.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } }));
  if (!owned) throw new HttpError(404, "Announcement not found");

  await updateAnnouncement(ctx, id, {
    title: input.title,
    body: input.body,
    isPinned: input.isPinned,
    requiresAck: input.requiresAck,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  revalidatePath("/franchisor/announcements");
  revalidatePath(`/franchisor/announcements/${id}`);
  redirect(`/franchisor/announcements/${id}`);
}

/** Toggle pinned. */
export async function togglePinAction(id: string, pinned: boolean) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const owned = await withTenant(ctx, (tx) => tx.announcement.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } }));
  if (!owned) throw new HttpError(404, "Announcement not found");
  await updateAnnouncement(ctx, id, { isPinned: pinned });
  revalidatePath("/franchisor/announcements");
  revalidatePath(`/franchisor/announcements/${id}`);
}

/** Expire (hide from stores) immediately. */
export async function expireAnnouncementAction(id: string) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  await withTenant(ctx, async (tx) => {
    const a = await tx.announcement.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!a) throw new HttpError(404, "Announcement not found");
    const after = await tx.announcement.update({ where: { id }, data: { status: "EXPIRED", expiresAt: new Date() } });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "announcement.expire", entity: "Announcement", entityId: id, before: { status: a.status }, after: { status: after.status } });
  });
  revalidatePath("/franchisor/announcements");
  revalidatePath(`/franchisor/announcements/${id}`);
}

/** Duplicate as a new DRAFT and go to its edit page. */
export async function duplicateAnnouncementAction(id: string) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const newId = await withTenant(ctx, async (tx) => {
    const src = await tx.announcement.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!src) throw new HttpError(404, "Announcement not found");
    const copy = await tx.announcement.create({
      data: { tenantId: ctx.tenantId, title: `${src.title} (copy)`, body: src.body, isPinned: false, requiresAck: src.requiresAck, status: "DRAFT", createdBy: ctx.userId },
    });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "announcement.duplicate", entity: "Announcement", entityId: copy.id, after: { from: id } });
    return copy.id;
  });
  revalidatePath("/franchisor/announcements");
  redirect(`/franchisor/announcements/${newId}/edit`);
}

/** Delete a draft only (published/scheduled must be expired, not deleted). */
export async function deleteDraftAction(id: string) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  await withTenant(ctx, async (tx) => {
    const a = await tx.announcement.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!a) throw new HttpError(404, "Announcement not found");
    if (a.status !== "DRAFT") throw new HttpError(400, "Only draft announcements can be deleted. Expire published announcements instead.");
    await tx.announcement.delete({ where: { id } });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "announcement.delete", entity: "Announcement", entityId: id, before: { title: a.title } });
  });
  revalidatePath("/franchisor/announcements");
  redirect("/franchisor/announcements");
}

/**
 * Exports the full per-user acknowledgement breakdown for one announcement as
 * a CSV download. Returns base64-encoded CSV data that the client decodes and
 * triggers as a download — same shape as bulkExportAuditLogsAction.
 * FRANCHISOR_ADMIN (own tenant) or KICK_ADMIN (any tenant, tenantId passed in).
 */
export async function bulkExportAcknowledgementCsvAction(announcementId: string, tenantId?: string): Promise<{ ok: boolean; message: string; csv?: string }> {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const scopedTenantId = ctx.role === "FRANCHISOR_ADMIN" ? ctx.tenantId : tenantId;
  if (!scopedTenantId) return { ok: false, message: "A tenant is required." };

  const rows = await getAllAnnouncementAcknowledgementUsers(ctx, announcementId, scopedTenantId);
  if (!rows.length) return { ok: false, message: "No users to export." };

  const headers = ["Name", "Email", "Store", "Status", "Acknowledged At"];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [
        csvCell(r.displayName),
        csvCell(r.email),
        csvCell(r.locationName),
        r.pending ? "Pending" : "Acknowledged",
        r.acknowledgedAt ? r.acknowledgedAt.toISOString() : "",
      ].join(",")
    ),
  ];

  const csv = csvRows.join("\n");
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return { ok: true, message: `${rows.length} users exported.`, csv: base64 };
}
