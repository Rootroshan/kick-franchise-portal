import { AssetStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type AssetRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  mime: string;
  sizeBytes: number;
  version: number;
  brandName: string;
  brandSlug: string;
  createdAt: Date;
};

export type AssetListResult = { rows: AssetRow[]; total: number };

const STATUS_VALUES = new Set(Object.values(AssetStatus) as string[]);

/** Cross-tenant artwork/asset list with search/type/status/brand/pagination. KICK_ADMIN only.
 *  Artwork is uploaded and managed by Kick only (see asset write routes). */
export async function listAssetsAdmin(ctx: RequestContext, q: AdminListQuery): Promise<AssetListResult> {
  return withTenant(ctx, async (tx) => {
    const type = q.raw.type ?? "";
    const where = {
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { category: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.status && STATUS_VALUES.has(q.status) ? { status: q.status as AssetStatus } : {}),
      ...(type ? { type } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const orderBy = q.sort === "name" ? { name: q.direction } : q.sort === "size" ? { sizeBytes: q.direction } : { createdAt: q.direction };

    const [items, total] = await Promise.all([
      tx.asset.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: { tenant: { select: { name: true, slug: true } } } }),
      tx.asset.count({ where }),
    ]);

    const rows: AssetRow[] = items.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      category: a.category,
      status: a.status,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      version: a.version,
      brandName: a.tenant.name,
      brandSlug: a.tenant.slug,
      createdAt: a.createdAt,
    }));

    return { rows, total };
  });
}

export type AssetKpis = { total: number; active: number; archived: number; totalBytes: number };

export async function getAssetKpis(ctx: RequestContext): Promise<AssetKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, active, archived, size] = await Promise.all([
      tx.asset.count(),
      tx.asset.count({ where: { status: AssetStatus.ACTIVE } }),
      tx.asset.count({ where: { status: AssetStatus.ARCHIVED } }),
      tx.asset.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    return { total, active, archived, totalBytes: size._sum.sizeBytes ?? 0 };
  });
}

/** Distinct asset types present, for the type filter. */
export async function getAssetTypeOptions(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const types = await tx.asset.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } });
    return types.map((t) => ({ value: t.type, label: t.type.charAt(0).toUpperCase() + t.type.slice(1) }));
  });
}
