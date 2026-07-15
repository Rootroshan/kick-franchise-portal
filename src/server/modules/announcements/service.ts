import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createAnnouncementSchema, updateAnnouncementSchema } from "./schemas";

/** KICK_ADMIN and FRANCHISOR_ADMIN may create/manage announcements for their tenant. */
export async function createAnnouncement(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAnnouncementSchema>) {
  return withTenant(ctx, async (tx) => {
    const status = input.publishAt && input.publishAt > new Date() ? "SCHEDULED" : "PUBLISHED";
    const announcement = await tx.announcement.create({
      data: {
        tenantId,
        title: input.title,
        body: input.body,
        isPinned: input.isPinned,
        publishAt: input.publishAt ?? null,
        expiresAt: input.expiresAt ?? null,
        requiresAck: input.requiresAck,
        status,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "announcement.create",
      entity: "Announcement",
      entityId: announcement.id,
      after: announcement,
    });

    return announcement;
  });
}

export async function updateAnnouncement(ctx: RequestContext, id: string, input: z.infer<typeof updateAnnouncementSchema>) {
  return withTenant(ctx, async (tx) => {
    const before = await tx.announcement.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Announcement not found");

    const after = await tx.announcement.update({
      where: { id },
      data: {
        ...input,
        // Re-evaluate status if publishAt changed and it hasn't been published yet.
        status:
          input.publishAt !== undefined && before.status === "DRAFT"
            ? input.publishAt && input.publishAt > new Date()
              ? "SCHEDULED"
              : "PUBLISHED"
            : undefined,
      },
    });

    await writeAuditLog(tx, {
      tenantId: after.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "announcement.update",
      entity: "Announcement",
      entityId: id,
      before,
      after,
    });

    return after;
  });
}

/**
 * [K,F]: sees all statuses for their tenant (or all tenants for KICK_ADMIN).
 * [U]: sees only PUBLISHED, non-expired announcements — scheduled and
 * expired ones must remain invisible per spec §10.1 acceptance criteria.
 */
export async function listAnnouncements(ctx: RequestContext, tenantId: string) {
  return withTenant(ctx, (tx) => {
    if (ctx.role === "FRANCHISEE_USER") {
      const now = new Date();
      return tx.announcement.findMany({
        where: {
          tenantId,
          status: "PUBLISHED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { acks: { where: { clerkUserId: ctx.userId } } },
        orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      });
    }
    return tx.announcement.findMany({
      where: { tenantId },
      include: { acks: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  });
}

/** Idempotent: unique constraint on (announcementId, clerkUserId) makes a repeat ack a no-op. */
export async function acknowledgeAnnouncement(ctx: RequestContext, announcementId: string) {
  if (ctx.role !== "FRANCHISEE_USER") {
    throw new HttpError(403, "Only franchisee users acknowledge announcements");
  }
  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement || announcement.tenantId !== ctx.tenantId || announcement.status !== "PUBLISHED") {
      throw new HttpError(404, "Announcement not found");
    }

    return tx.announcementAck.upsert({
      where: { announcementId_clerkUserId: { announcementId, clerkUserId: ctx.userId } },
      create: { announcementId, clerkUserId: ctx.userId, locationId: ctx.locationId },
      update: {}, // already acknowledged — idempotent no-op
    });
  });
}

/** Per-location acknowledgement report for admins. */
export async function getAcknowledgementReport(ctx: RequestContext, announcementId: string) {
  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) throw new HttpError(404, "Announcement not found");

    const [acks, locations] = await Promise.all([
      tx.announcementAck.findMany({ where: { announcementId }, include: { location: true } }),
      tx.location.findMany({ where: { tenantId: announcement.tenantId } }),
    ]);

    const ackedLocationIds = new Set(acks.map((a) => a.locationId).filter(Boolean));
    return {
      totalLocations: locations.length,
      acknowledgedCount: ackedLocationIds.size,
      locations: locations.map((l) => ({
        locationId: l.id,
        locationName: l.name,
        acknowledged: ackedLocationIds.has(l.id),
      })),
    };
  });
}
