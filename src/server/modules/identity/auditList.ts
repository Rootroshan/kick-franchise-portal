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
    const [total, last24h, actors] = await Promise.all([
      tx.auditLog.count(),
      tx.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
      tx.auditLog.findMany({ distinct: ["actorId"], select: { actorId: true } }),
    ]);
    return { total, last24h, distinctActors: actors.length };
  });
}

/** Distinct entities for the entity filter. */
export async function getAuditEntityOptions(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const entities = await tx.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } });
    return entities.map((e) => ({ value: e.entity, label: e.entity }));
  });
}
