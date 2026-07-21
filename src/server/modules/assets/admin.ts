import { AssetStatus, type Prisma } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
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
  uploaderName: string | null;
};

export type AssetListResult = { rows: AssetRow[]; total: number };

const STATUS_VALUES = new Set(Object.values(AssetStatus) as string[]);

/** Batch-resolve `Asset.createdBy` user ids to a display name, since there is no Prisma relation. */
export async function resolveUploaderNames(tx: Prisma.TransactionClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return new Map();
  const users = await tx.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name ?? u.email]));
}

/** Cross-tenant artwork/asset list with search/type/status/brand/pagination. KICK_ADMIN only.
 *  Artwork may be uploaded by Kick or by a franchisor for their own brand. */
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

    const uploaderNames = await resolveUploaderNames(tx, items.map((a) => a.createdBy));

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
      uploaderName: uploaderNames.get(a.createdBy) ?? null,
    }));

    return { rows, total };
  });
}

export type AssetKpis = { total: number; active: number; archived: number; totalBytes: number; totalDownloads: number };

export async function getAssetKpis(ctx: RequestContext): Promise<AssetKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, active, archived, size, totalDownloads] = await Promise.all([
      tx.asset.count(),
      tx.asset.count({ where: { status: AssetStatus.ACTIVE } }),
      tx.asset.count({ where: { status: AssetStatus.ARCHIVED } }),
      tx.asset.aggregate({ _sum: { sizeBytes: true } }),
      tx.auditLog.count({ where: { entity: "Asset", action: "asset.download" } }),
    ]);
    return { total, active, archived, totalBytes: size._sum.sizeBytes ?? 0, totalDownloads };
  });
}

/** Distinct asset types present, for the type filter. */
export async function getAssetTypeOptions(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const types = await tx.asset.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } });
    return types.map((t) => ({ value: t.type, label: t.type.charAt(0).toUpperCase() + t.type.slice(1) }));
  });
}

/** Brand options (id + name) for the KICK_ADMIN upload form's brand selector. */
export async function getBrandUploadTargets(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const brands = await tx.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    return brands.map((b) => ({ value: b.id, label: b.name }));
  });
}

export type AssetAdminDetail = AssetRow & { tenantId: string };

/** Cross-tenant single-asset lookup for the KICK_ADMIN replace/version-history flows. */
export async function getAssetAdminDetail(ctx: RequestContext, id: string): Promise<AssetAdminDetail> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.asset.findUnique({ where: { id }, include: { tenant: { select: { name: true, slug: true } } } });
    if (!a) throw new HttpError(404, "Asset not found");
    const uploaderNames = await resolveUploaderNames(tx, [a.createdBy]);
    return {
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
      uploaderName: uploaderNames.get(a.createdBy) ?? null,
      tenantId: a.tenantId,
    };
  });
}
