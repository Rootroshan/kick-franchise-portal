import { AnnouncementStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type AnnouncementRow = {
  id: string;
  title: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
  brandName: string;
  brandSlug: string;
  publishAt: Date | null;
  ackCount: number;
  createdAt: Date;
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

    const rows: AnnouncementRow[] = items.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      isPinned: a.isPinned,
      requiresAck: a.requiresAck,
      brandName: a.tenant.name,
      brandSlug: a.tenant.slug,
      publishAt: a.publishAt,
      ackCount: a._count.acks,
      createdAt: a.createdAt,
    }));

    return { rows, total };
  });
}

export type AnnouncementKpis = { total: number; published: number; scheduled: number; drafts: number };

export async function getAnnouncementKpis(ctx: RequestContext): Promise<AnnouncementKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, published, scheduled, drafts] = await Promise.all([
      tx.announcement.count(),
      tx.announcement.count({ where: { status: AnnouncementStatus.PUBLISHED } }),
      tx.announcement.count({ where: { status: AnnouncementStatus.SCHEDULED } }),
      tx.announcement.count({ where: { status: AnnouncementStatus.DRAFT } }),
    ]);
    return { total, published, scheduled, drafts };
  });
}
