import { AssetStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

/** Tenant-scoped artwork list for the franchisor Artwork Hub. No commerce. */
export type AssetRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  mime: string;
  sizeBytes: number;
  version: number;
  createdAt: Date;
};

export type AssetListResult = { rows: AssetRow[]; total: number; categories: Array<{ name: string; count: number }>; totalCount: number };

const STATUS_VALUES = new Set(Object.values(AssetStatus) as string[]);

export async function listFranchisorAssets(ctx: RequestContext, tenantId: string, q: AdminListQuery): Promise<AssetListResult> {
  return withTenant(ctx, async (tx) => {
    const category = q.raw.category ?? "";
    const type = q.raw.type ?? "";
    const where = {
      tenantId,
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { category: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.status && STATUS_VALUES.has(q.status) ? { status: q.status as AssetStatus } : {}),
      ...(category && category !== "all" ? { category } : {}),
      ...(type ? { type } : {}),
    };

    const orderBy = q.sort === "name" ? { name: q.direction } : { createdAt: q.direction };

    const [items, total, byCategory, totalCount] = await Promise.all([
      tx.asset.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit }),
      tx.asset.count({ where }),
      tx.asset.groupBy({ by: ["category"], where: { tenantId }, _count: true }),
      tx.asset.count({ where: { tenantId } }),
    ]);

    const categories = byCategory
      .map((c) => ({ name: c.category ?? "Other", count: c._count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      rows: items.map((a) => ({ id: a.id, name: a.name, type: a.type, category: a.category, status: a.status, mime: a.mime, sizeBytes: a.sizeBytes, version: a.version, createdAt: a.createdAt })),
      total,
      categories,
      totalCount,
    };
  });
}

export type AssetDetail = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  mime: string;
  sizeBytes: number;
  version: number;
  createdAt: Date;
  createdBy: string;
};

export async function getFranchisorAsset(ctx: RequestContext, tenantId: string, id: string): Promise<AssetDetail> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.asset.findFirst({ where: { id, tenantId } });
    if (!a) throw new HttpError(404, "Asset not found");
    return { id: a.id, name: a.name, type: a.type, category: a.category, status: a.status, mime: a.mime, sizeBytes: a.sizeBytes, version: a.version, createdAt: a.createdAt, createdBy: a.createdBy };
  });
}
