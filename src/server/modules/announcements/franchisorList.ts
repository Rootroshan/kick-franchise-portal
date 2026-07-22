import { AnnouncementStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { startOfDay, endOfDay, type AdminListQuery } from "@/lib/adminQuery";

/**
 * Tenant-scoped announcement list for the franchisor portal: search + status
 * tab + pagination + ack rollups. Franchisor sees every status for their own
 * brand (RLS scopes tenant). No commerce fields.
 */
export type FranchisorAnnouncementRow = {
  id: string;
  title: string;
  excerpt: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  ackCount: number;
  targetStores: number;
  readPercent: number;
  updatedAt: Date;
};

export type AnnouncementListResult = { rows: FranchisorAnnouncementRow[]; total: number; counts: Record<string, number> };

const STATUS_VALUES = new Set(Object.values(AnnouncementStatus) as string[]);

export async function listFranchisorAnnouncements(ctx: RequestContext, tenantId: string, q: AdminListQuery): Promise<AnnouncementListResult> {
  return withTenant(ctx, async (tx) => {
    const statusFilter = q.status && STATUS_VALUES.has(q.status) ? (q.status as AnnouncementStatus) : undefined;
    const where = {
      tenantId,
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: "insensitive" as const } }, { body: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q.raw.pinned === "true" ? { isPinned: true } : {}),
      ...(q.raw.requiresAck === "true" ? { requiresAck: true } : {}),
      ...(q.date ? { publishAt: { gte: startOfDay(q.date), lt: endOfDay(q.date) } } : {}),
    };

    // Pinned always sorts first, even when sorting by title/publishAt — was
    // previously dropped on any non-default sort.
    const secondarySort = q.sort === "title" ? { title: q.direction } : q.sort === "publishAt" ? { publishAt: q.direction } : { createdAt: q.direction };
    const orderBy = [{ isPinned: "desc" as const }, secondarySort];

    const [items, total, activeStores, statusGroups] = await Promise.all([
      tx.announcement.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: { _count: { select: { acks: true } } } }),
      tx.announcement.count({ where }),
      tx.location.count({ where: { tenantId, status: "active" } }),
      tx.announcement.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    ]);

    const target = activeStores || 1;
    const rows: FranchisorAnnouncementRow[] = items.map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.body.slice(0, 140),
      status: a.status,
      isPinned: a.isPinned,
      requiresAck: a.requiresAck,
      publishAt: a.publishAt,
      expiresAt: a.expiresAt,
      createdBy: a.createdBy,
      ackCount: a._count.acks,
      targetStores: activeStores,
      readPercent: a.requiresAck ? Math.min(100, Math.round((a._count.acks / target) * 100)) : 0,
      updatedAt: a.updatedAt,
    }));

    const counts: Record<string, number> = { all: 0 };
    let all = 0;
    for (const g of statusGroups) {
      counts[g.status] = g._count;
      all += g._count;
    }
    counts.all = all;

    return { rows, total, counts };
  });
}

export type AnnouncementDetail = {
  id: string;
  title: string;
  body: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  targetStores: number;
  acknowledged: Array<{ locationName: string; acknowledgedAt: Date }>;
  notAcknowledged: string[];
};

export async function getFranchisorAnnouncement(ctx: RequestContext, tenantId: string, id: string): Promise<AnnouncementDetail> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.announcement.findFirst({ where: { id, tenantId } });
    if (!a) throw new HttpError(404, "Announcement not found");

    const [acks, locations] = await Promise.all([
      tx.announcementAck.findMany({ where: { announcementId: id }, include: { location: { select: { name: true } } } }),
      tx.location.findMany({ where: { tenantId, status: "active" }, select: { id: true, name: true } }),
    ]);

    const ackedLocationIds = new Set(acks.map((k) => k.locationId));
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      status: a.status,
      isPinned: a.isPinned,
      requiresAck: a.requiresAck,
      publishAt: a.publishAt,
      expiresAt: a.expiresAt,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      targetStores: locations.length,
      acknowledged: acks.map((k) => ({ locationName: k.location?.name ?? "Unknown", acknowledgedAt: k.acknowledgedAt })),
      notAcknowledged: locations.filter((l) => !ackedLocationIds.has(l.id)).map((l) => l.name),
    };
  });
}
