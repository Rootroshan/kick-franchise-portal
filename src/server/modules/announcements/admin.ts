import { AnnouncementStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { startOfDay, endOfDay, type AdminListQuery } from "@/lib/adminQuery";
import { z } from "zod";

export type AnnouncementRow = {
  id: string;
  title: string;
  excerpt: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
  brandName: string;
  brandSlug: string;
  publishAt: Date | null;
  expiresAt: Date | null;
  ackCount: number;
  /** FRANCHISEE_USER memberships in the announcement's tenant — the ack denominator. */
  eligibleCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AnnouncementListResult = { rows: AnnouncementRow[]; total: number };

const STATUS_VALUES = new Set(Object.values(AnnouncementStatus) as string[]);

/** Cross-tenant announcements list with search/status/brand/sort/pagination + ack counts. KICK_ADMIN only. */
export async function listAnnouncementsAdmin(ctx: RequestContext, q: AdminListQuery): Promise<AnnouncementListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: "insensitive" as const } }, { body: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.status && STATUS_VALUES.has(q.status) ? { status: q.status as AnnouncementStatus } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
      ...(q.date ? { publishAt: { gte: startOfDay(q.date), lt: endOfDay(q.date) } } : {}),
    };

    // Pinned always sorts first, regardless of which column the operator
    // chose to sort by — matching the franchisor list and franchisee feed,
    // neither of which drop pinned-first when a non-default sort is picked.
    const secondarySort =
      q.sort === "title"
        ? { title: q.direction }
        : q.sort === "status"
        ? { status: q.direction }
        : q.sort === "publishAt"
        ? { publishAt: q.direction }
        : { createdAt: q.direction };
    const orderBy = [{ isPinned: "desc" as const }, secondarySort];

    const [items, total] = await Promise.all([
      tx.announcement.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } }, _count: { select: { acks: true } } },
      }),
      tx.announcement.count({ where }),
    ]);

    // One grouped query for the ack denominator ("234 / 280" on each card):
    // FRANCHISEE_USER membership counts per tenant on this page — no N+1.
    const tenantIds = [...new Set(items.map((a) => a.tenantId))];
    const memberCounts = tenantIds.length
      ? await tx.membership.groupBy({ by: ["tenantId"], where: { role: "FRANCHISEE_USER", tenantId: { in: tenantIds } }, _count: true })
      : [];
    const eligibleByTenant = new Map(memberCounts.map((m) => [m.tenantId, m._count]));

    const rows: AnnouncementRow[] = items.map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.body.slice(0, 140),
      status: a.status,
      isPinned: a.isPinned,
      requiresAck: a.requiresAck,
      brandName: a.tenant.name,
      brandSlug: a.tenant.slug,
      publishAt: a.publishAt,
      expiresAt: a.expiresAt,
      ackCount: a._count.acks,
      eligibleCount: eligibleByTenant.get(a.tenantId) ?? 0,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return { rows, total };
  });
}

export type AnnouncementKpis = { total: number; published: number; scheduled: number; drafts: number; expired: number };

export async function getAnnouncementKpis(ctx: RequestContext): Promise<AnnouncementKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, published, scheduled, drafts, expired] = await Promise.all([
      tx.announcement.count(),
      tx.announcement.count({ where: { status: AnnouncementStatus.PUBLISHED } }),
      tx.announcement.count({ where: { status: AnnouncementStatus.SCHEDULED } }),
      tx.announcement.count({ where: { status: AnnouncementStatus.DRAFT } }),
      tx.announcement.count({ where: { status: AnnouncementStatus.EXPIRED } }),
    ]);
    return { total, published, scheduled, drafts, expired };
  });
}

export type PublishCalendarDay = { date: string; scheduledCount: number; publishedCount: number };

const calendarArgsSchema = z.object({
  tenantId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(3000),
  month: z.coerce.number().int().min(1).max(12), // 1-12
});

/**
 * Publish-calendar data for one month: per-day counts of announcements
 * SCHEDULED to publish that day, and announcements actually PUBLISHED that
 * day (by publishAt). One findMany spanning the month, bucketed in memory —
 * same pattern as the dashboard sales series (src/server/modules/dashboard/service.ts).
 */
export async function getAnnouncementPublishCalendar(
  ctx: RequestContext,
  tenantId: string | undefined,
  year: number,
  month: number
): Promise<PublishCalendarDay[]> {
  const args = calendarArgsSchema.parse({ tenantId, year, month });

  return withTenant(ctx, async (tx) => {
    const start = new Date(Date.UTC(args.year, args.month - 1, 1));
    const end = new Date(Date.UTC(args.year, args.month, 1));

    const items = await tx.announcement.findMany({
      where: {
        ...(args.tenantId ? { tenantId: args.tenantId } : {}),
        publishAt: { gte: start, lt: end },
        status: { in: [AnnouncementStatus.SCHEDULED, AnnouncementStatus.PUBLISHED, AnnouncementStatus.EXPIRED] },
      },
      select: { publishAt: true, status: true },
    });

    const byDay = new Map<string, { scheduledCount: number; publishedCount: number }>();
    for (const item of items) {
      if (!item.publishAt) continue;
      const dateKey = item.publishAt.toISOString().slice(0, 10); // YYYY-MM-DD
      const bucket = byDay.get(dateKey) ?? { scheduledCount: 0, publishedCount: 0 };
      if (item.status === AnnouncementStatus.SCHEDULED) bucket.scheduledCount += 1;
      else bucket.publishedCount += 1; // PUBLISHED or EXPIRED both "published" for calendar purposes
      byDay.set(dateKey, bucket);
    }

    return Array.from(byDay.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

export type AnnouncementActivityRow = {
  id: string;
  action: string;
  label: string;
  entityId: string | null;
  /** Title of the announcement the event refers to; null when it has been deleted. */
  entityTitle: string | null;
  actorId: string;
  createdAt: Date;
};

const ACTION_LABELS: Record<string, string> = {
  "announcement.create": "created",
  "announcement.update": "edited",
  "announcement.status": "status changed",
  "announcement.expire": "expired",
  "announcement.duplicate": "duplicated",
  "announcement.delete": "deleted",
  "announcement.acknowledge": "acknowledged",
  "announcement.report_view": "report viewed",
};

/**
 * Recent Announcement-scoped activity for the dashboard rail, read from the
 * existing AuditLog table (entity: "Announcement") — no new table.
 * tenantId-scoped for FRANCHISOR_ADMIN, unscoped (cross-tenant) for KICK_ADMIN
 * when tenantId is omitted.
 */
export async function getAnnouncementRecentActivity(ctx: RequestContext, tenantId?: string, limit = 10): Promise<AnnouncementActivityRow[]> {
  const take = Math.min(50, Math.max(1, limit));
  return withTenant(ctx, async (tx) => {
    const rows = await tx.auditLog.findMany({
      where: { entity: "Announcement", ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, action: true, entityId: true, actorId: true, createdAt: true },
    });

    // One lookup for the referenced announcements' titles (subtitle line in
    // the Recent Activity card) — deleted announcements simply resolve null.
    const entityIds = [...new Set(rows.map((r) => r.entityId).filter((id): id is string => !!id))];
    const titles = entityIds.length
      ? await tx.announcement.findMany({ where: { id: { in: entityIds } }, select: { id: true, title: true } })
      : [];
    const titleById = new Map(titles.map((t) => [t.id, t.title]));

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      label: ACTION_LABELS[r.action] ?? r.action,
      entityId: r.entityId,
      entityTitle: r.entityId ? titleById.get(r.entityId) ?? null : null,
      actorId: r.actorId,
      createdAt: r.createdAt,
    }));
  });
}

export type FeaturedAckAnnouncement = { id: string; title: string } | null;

/**
 * Most recently created requiresAck announcement — used to give the list
 * page's Acknowledgement Summary rail card a real, well-defined
 * announcementId (getAcknowledgementSummary has no meaningful brand-wide
 * "acknowledged" figure without one; every requiresAck announcement has its
 * own audience/ack set).
 */
export async function getFeaturedAckAnnouncement(ctx: RequestContext, tenantId?: string): Promise<FeaturedAckAnnouncement> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.announcement.findFirst({
      where: { requiresAck: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });
    return a;
  });
}
