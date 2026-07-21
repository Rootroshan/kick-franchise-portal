import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { sendPushToLocationMembers } from "../../../../worker/push/send";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createAnnouncementSchema, updateAnnouncementSchema } from "./schemas";

/** KICK_ADMIN and FRANCHISOR_ADMIN may create/manage announcements for their tenant. */
export async function createAnnouncement(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAnnouncementSchema>) {
  const announcement = await withTenant(ctx, async (tx) => {
    const status = input.publishAt && input.publishAt > new Date() ? "SCHEDULED" : "PUBLISHED";
    const created = await tx.announcement.create({
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
      entityId: created.id,
      after: created,
    });

    return created;
  });

  // Notify store users once the announcement is actually visible to them.
  // Runs AFTER the transaction commits so a notification never references a
  // row that got rolled back, and a notification failure can't void the
  // announcement itself.
  if (announcement.status === "PUBLISHED") {
    await notifyTenantMembers(ctx, {
      tenantId,
      role: "FRANCHISEE_USER",
      category: "ANNOUNCEMENT",
      title: announcement.requiresAck ? `Action required: ${announcement.title}` : announcement.title,
      body: announcement.body.slice(0, 200),
      href: `/announcements/${announcement.id}`,
      entity: "Announcement",
      entityId: announcement.id,
    }).catch(() => {
      // Never fail the publish because the inbox fan-out failed.
    });

    // Push, with per-recipient email fallback — same call the scheduled-
    // publish cron job makes (worker/jobs/announcements.ts). Immediate
    // publish previously only fired the in-app inbox notification above;
    // a "publish now" announcement got no push at all.
    await sendPushToLocationMembers(tenantId, {
      title: "New announcement",
      body: announcement.title,
      url: `/announcements/${announcement.id}`,
    }).catch(() => {
      // Never fail the publish because push delivery failed.
    });
  }

  return announcement;
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
 * [K,F]: sees all statuses for their tenant (or all tenants for KICK_ADMIN
 * when no tenant is resolved, e.g. browsing the apex domain).
 * [U]: sees only PUBLISHED, non-expired announcements — scheduled and
 * expired ones must remain invisible per spec §10.1 acceptance criteria.
 */
export async function listAnnouncements(ctx: RequestContext, tenantId: string | null) {
  return withTenant(ctx, (tx) => {
    if (ctx.role === "FRANCHISEE_USER") {
      const now = new Date();
      return tx.announcement.findMany({
        where: {
          tenantId: tenantId ?? undefined,
          status: "PUBLISHED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { acks: { where: { clerkUserId: ctx.userId } } },
        orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      });
    }
    return tx.announcement.findMany({
      where: { tenantId: tenantId ?? undefined },
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
/**
 * `tenantId` is required for FRANCHISOR_ADMIN (pinned to their own brand —
 * never trust a wider lookup for that role) and omitted for KICK_ADMIN, who
 * may legitimately pull the report for any tenant's announcement. Explicit
 * app-layer check either way, matching getFranchisorAnnouncement's
 * convention rather than relying solely on the RLS session policy.
 */
export async function getAcknowledgementReport(ctx: RequestContext, announcementId: string, tenantId?: string) {
  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findFirst({ where: { id: announcementId, ...(tenantId ? { tenantId } : {}) } });
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
