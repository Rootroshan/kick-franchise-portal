import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { sendPushToLocationMembers } from "../../../../worker/push/send";
import { HttpError } from "@/server/modules/identity/errors";
import { z } from "zod";
import type { createAnnouncementSchema, updateAnnouncementSchema } from "./schemas";

/** KICK_ADMIN and FRANCHISOR_ADMIN may create/manage announcements for their tenant. */
export async function createAnnouncement(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAnnouncementSchema>) {
  const announcement = await withTenant(ctx, async (tx) => {
    const status = input.asDraft ? "DRAFT" : input.publishAt && input.publishAt > new Date() ? "SCHEDULED" : "PUBLISHED";
    const created = await tx.announcement.create({
      data: {
        tenantId,
        title: input.title,
        body: input.body,
        isPinned: input.isPinned,
        // Immediate publish stamps the server clock so the feed can show a
        // real "Published <date>" and sort by publishAt consistently — a
        // null publishAt on a PUBLISHED row sorted NULLS FIRST and rendered
        // no date at all.
        publishAt: input.publishAt ?? (status === "PUBLISHED" ? new Date() : null),
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

    // A Kick publish is news to the brand's admins too — they didn't author
    // it, so their bell should light up. A franchisor publishing their own
    // announcement gets no self-notification.
    if (ctx.role === "KICK_ADMIN") {
      await notifyTenantMembers(ctx, {
        tenantId,
        role: "FRANCHISOR_ADMIN",
        category: "ANNOUNCEMENT",
        title: `New announcement for your brand: ${announcement.title}`,
        body: announcement.body.slice(0, 200),
        href: `/franchisor/announcements/${announcement.id}`,
        entity: "Announcement",
        entityId: announcement.id,
      }).catch(() => {
        // Best-effort, same as above.
      });
    }

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
          AND: [
            // Visible = PUBLISHED, or SCHEDULED whose publishAt has passed but
            // the cron worker hasn't flipped yet — the live check means a
            // worker outage can never hide a due announcement from stores.
            { OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED", publishAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        include: {
          acks: { where: { clerkUserId: ctx.userId } },
          // Row-level read state for the current user only — powers the
          // Unread tab / unread dot without a second query.
          reads: { where: { clerkUserId: ctx.userId } },
        },
        orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      });
    }
    return tx.announcement.findMany({
      where: { tenantId: tenantId ?? undefined },
      // reads included here too so both branches return one shape (callers
      // can rely on `.reads` without narrowing the union).
      include: { acks: true, reads: true },
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

    const ack = await tx.announcementAck.upsert({
      where: { announcementId_clerkUserId: { announcementId, clerkUserId: ctx.userId } },
      create: { announcementId, clerkUserId: ctx.userId, locationId: ctx.locationId },
      update: {}, // already acknowledged — idempotent no-op
    });

    await writeAuditLog(tx, {
      tenantId: announcement.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "announcement.acknowledge",
      entity: "Announcement",
      entityId: announcementId,
    });

    return ack;
  });
}

/**
 * [U]: marks an announcement as read (opened) for the current user.
 * Idempotent upsert on (announcementId, clerkUserId). Mirrors
 * acknowledgeAnnouncement's guard — same tenant + a status the franchisee
 * feed would actually show (PUBLISHED, or SCHEDULED that is already due) —
 * so a crafted id can never create read state on hidden/foreign rows.
 */
export async function markAnnouncementRead(ctx: RequestContext, announcementId: string) {
  if (ctx.role !== "FRANCHISEE_USER") {
    throw new HttpError(403, "Only franchisee users have announcement read state");
  }
  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findUnique({ where: { id: announcementId } });
    const due = announcement?.status === "SCHEDULED" && announcement.publishAt != null && announcement.publishAt <= new Date();
    const visible = announcement?.status === "PUBLISHED" || due;
    if (!announcement || announcement.tenantId !== ctx.tenantId || !visible) {
      throw new HttpError(404, "Announcement not found");
    }

    return tx.announcementRead.upsert({
      where: { announcementId_clerkUserId: { announcementId, clerkUserId: ctx.userId } },
      create: { announcementId, clerkUserId: ctx.userId },
      update: {}, // already read — idempotent no-op
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
      // Additive: lets a caller that omitted tenantId (KICK_ADMIN) resolve it
      // from the announcement itself, e.g. to call the per-user report query
      // below, which requires an explicit tenantId. title likewise saves the
      // report page a second lookup just to render its own heading.
      tenantId: announcement.tenantId,
      title: announcement.title,
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

/** Store filter options for the per-user report table — every active location in the tenant. */
export async function getAnnouncementLocationOptions(ctx: RequestContext, tenantId: string): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const locations = await tx.location.findMany({ where: { tenantId, status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    return locations.map((l) => ({ value: l.id, label: l.name }));
  });
}

export type AcknowledgementSummary = {
  totalEligibleUsers: number;
  acknowledgedUsers: number;
  pendingUsers: number;
  percent: number;
};

/**
 * Brand-wide (announcementId omitted) or single-announcement acknowledgement
 * aggregate. "Eligible" = FRANCHISEE_USER memberships in the tenant — there is
 * no per-user/per-store targeting on Announcement, so the eligible population
 * is always every store user in the tenant (see schema note: acks are
 * recorded per-location for reporting only, not for targeting).
 */
export async function getAcknowledgementSummary(
  ctx: RequestContext,
  tenantId?: string,
  announcementId?: string
): Promise<AcknowledgementSummary> {
  return withTenant(ctx, async (tx) => {
    let scopedTenantId = tenantId;
    if (announcementId) {
      const announcement = await tx.announcement.findFirst({ where: { id: announcementId, ...(tenantId ? { tenantId } : {}) } });
      if (!announcement) throw new HttpError(404, "Announcement not found");
      scopedTenantId = announcement.tenantId;
    }

    const [totalEligibleUsers, acknowledgedUsers] = await Promise.all([
      tx.membership.count({ where: { role: "FRANCHISEE_USER", ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) } }),
      announcementId
        ? tx.announcementAck.count({ where: { announcementId } })
        : tx.membership.count({ where: { role: "FRANCHISEE_USER", ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) } }),
    ]);

    const pendingUsers = Math.max(0, totalEligibleUsers - acknowledgedUsers);
    const percent = totalEligibleUsers === 0 ? 0 : Math.round((acknowledgedUsers / totalEligibleUsers) * 100);
    return { totalEligibleUsers, acknowledgedUsers, pendingUsers, percent };
  });
}

export type AnnouncementAckUserRow = {
  clerkUserId: string;
  displayName: string | null;
  email: string | null;
  locationId: string | null;
  locationName: string | null;
  /** When the user opened the announcement — read ≠ acknowledged. */
  readAt: Date | null;
  acknowledgedAt: Date | null;
  pending: boolean;
};

const ackUsersOptsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  locationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
export type AckUsersOpts = z.input<typeof ackUsersOptsSchema>;

/**
 * Per-user acknowledgement rows for one announcement: every FRANCHISEE_USER
 * membership in the tenant, marked acknowledged/pending. tenantId ownership
 * is re-verified via findFirst({id, tenantId}) exactly like
 * getAcknowledgementReport, before any membership data is touched.
 */
export async function getAnnouncementAcknowledgementUsers(
  ctx: RequestContext,
  announcementId: string,
  tenantId: string,
  opts: AckUsersOpts
): Promise<{ rows: AnnouncementAckUserRow[]; total: number }> {
  const q = ackUsersOptsSchema.parse(opts);

  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findFirst({ where: { id: announcementId, tenantId } });
    if (!announcement) throw new HttpError(404, "Announcement not found");

    const where = {
      role: "FRANCHISEE_USER" as const,
      tenantId,
      ...(q.locationId ? { locationId: q.locationId } : {}),
      ...(q.search
        ? {
            OR: [
              { displayName: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [members, total, acks, reads] = await Promise.all([
      tx.membership.findMany({
        where,
        select: { clerkUserId: true, displayName: true, email: true, location: { select: { id: true, name: true } } },
        orderBy: { displayName: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      tx.membership.count({ where }),
      tx.announcementAck.findMany({ where: { announcementId }, select: { clerkUserId: true, acknowledgedAt: true } }),
      tx.announcementRead.findMany({ where: { announcementId }, select: { clerkUserId: true, readAt: true } }),
    ]);

    const ackByUser = new Map(acks.map((a) => [a.clerkUserId, a.acknowledgedAt]));
    const readByUser = new Map(reads.map((r) => [r.clerkUserId, r.readAt]));
    const rows: AnnouncementAckUserRow[] = members.map((m) => {
      const acknowledgedAt = ackByUser.get(m.clerkUserId) ?? null;
      return {
        clerkUserId: m.clerkUserId,
        displayName: m.displayName,
        email: m.email,
        locationId: m.location?.id ?? null,
        locationName: m.location?.name ?? null,
        readAt: readByUser.get(m.clerkUserId) ?? null,
        acknowledgedAt,
        pending: acknowledgedAt === null,
      };
    });

    return { rows, total };
  });
}

/**
 * Full (unpaginated) per-user rows for CSV export — same tenant-ownership
 * check as the paginated query, just no skip/take.
 */
export async function getAllAnnouncementAcknowledgementUsers(
  ctx: RequestContext,
  announcementId: string,
  tenantId: string
): Promise<AnnouncementAckUserRow[]> {
  return withTenant(ctx, async (tx) => {
    const announcement = await tx.announcement.findFirst({ where: { id: announcementId, tenantId } });
    if (!announcement) throw new HttpError(404, "Announcement not found");

    const [members, acks, reads] = await Promise.all([
      tx.membership.findMany({
        where: { role: "FRANCHISEE_USER", tenantId },
        select: { clerkUserId: true, displayName: true, email: true, location: { select: { id: true, name: true } } },
        orderBy: { displayName: "asc" },
      }),
      tx.announcementAck.findMany({ where: { announcementId }, select: { clerkUserId: true, acknowledgedAt: true } }),
      tx.announcementRead.findMany({ where: { announcementId }, select: { clerkUserId: true, readAt: true } }),
    ]);

    const ackByUser = new Map(acks.map((a) => [a.clerkUserId, a.acknowledgedAt]));
    const readByUser = new Map(reads.map((r) => [r.clerkUserId, r.readAt]));
    return members.map((m) => {
      const acknowledgedAt = ackByUser.get(m.clerkUserId) ?? null;
      return {
        clerkUserId: m.clerkUserId,
        displayName: m.displayName,
        email: m.email,
        locationId: m.location?.id ?? null,
        locationName: m.location?.name ?? null,
        readAt: readByUser.get(m.clerkUserId) ?? null,
        acknowledgedAt,
        pending: acknowledgedAt === null,
      };
    });
  });
}
