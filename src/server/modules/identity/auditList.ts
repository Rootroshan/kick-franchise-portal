import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string;
  role: string;
  brandName: string | null;
  ip: string | null;
  createdAt: Date;
};

export type AuditListResult = { rows: AuditRow[]; total: number };

/** Cross-tenant audit log with search (action/entity)/brand/pagination. KICK_ADMIN only. */
export async function listAuditLogsAdmin(ctx: RequestContext, q: AdminListQuery): Promise<AuditListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { OR: [{ action: { contains: q.search, mode: "insensitive" as const } }, { entity: { contains: q.search, mode: "insensitive" as const } }, { actorId: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
      ...(q.raw.entity ? { entity: q.raw.entity } : {}),
    };

    const [items, total] = await Promise.all([
      tx.auditLog.findMany({
        where,
        orderBy: { createdAt: q.direction },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true } } },
      }),
      tx.auditLog.count({ where }),
    ]);

    const rows: AuditRow[] = items.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      actorId: l.actorId,
      role: l.role,
      brandName: l.tenant?.name ?? null,
      ip: l.ip,
      createdAt: l.createdAt,
    }));

    return { rows, total };
  });
}

export type AuditKpis = { total: number; last24h: number; distinctActors: number };

export async function getAuditKpis(ctx: RequestContext): Promise<AuditKpis> {
  return withTenant(ctx, async (tx) => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // COUNT(DISTINCT ...) returns one row no matter how large the audit log
    // gets — findMany({distinct}) had to read back one row per distinct
    // actor just to take its length, an unbounded result set on a table that
    // only grows. Runs through the same RLS-scoped `tx`, so tenant isolation
    // is unchanged.
    const [total, last24h, actorRows] = await Promise.all([
      tx.auditLog.count(),
      tx.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
      tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(DISTINCT "actorId") AS count FROM "AuditLog"`,
    ]);
    return { total, last24h, distinctActors: Number(actorRows[0]?.count ?? 0) };
  });
}

/** Distinct entities for the entity filter. */
export async function getAuditEntityOptions(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const entities = await tx.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } });
    return entities.map((e) => ({ value: e.entity, label: e.entity }));
  });
}
