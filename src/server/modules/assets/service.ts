import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import { createPresignedUploadUrl, createPresignedDownloadUrl, assertValidUpload } from "@/server/lib/storage";
import type { z } from "zod";
import type { createAssetUploadSchema } from "./schemas";

/** [K,F]: request a presigned PUT URL for a new asset upload. Validates mime/size before issuing. */
export async function requestAssetUpload(_ctx: RequestContext, tenantId: string, mime: string, sizeBytes: number) {
  assertValidUpload(mime, sizeBytes);
  const storageKey = `tenants/${tenantId}/assets/${crypto.randomUUID()}`;
  const uploadUrl = await createPresignedUploadUrl(storageKey, mime);
  return { uploadUrl, storageKey };
}

/** [K,F]: finalize an asset record after the client has completed the presigned upload. */
export async function createAsset(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAssetUploadSchema>) {
  assertValidUpload(input.mime, input.sizeBytes);

  return withTenant(ctx, async (tx) => {
    let version = 1;
    if (input.replacesId) {
      const previous = await tx.asset.findUnique({ where: { id: input.replacesId } });
      if (previous && previous.tenantId === tenantId) {
        version = previous.version + 1;
        await tx.asset.update({ where: { id: previous.id }, data: { status: "ARCHIVED" } });
      }
    }

    const asset = await tx.asset.create({
      data: {
        tenantId,
        name: input.name,
        type: input.type,
        category: input.category ?? null,
        storageKey: input.storageKey,
        mime: input.mime,
        sizeBytes: input.sizeBytes,
        version,
        status: "ACTIVE",
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "asset.upload",
      entity: "Asset",
      entityId: asset.id,
      after: asset,
    });

    return asset;
  });
}

/** [K,F,U]: franchisees see only ACTIVE assets; admins see everything (incl. ARCHIVED/DEPRECATED). */
export async function listAssets(ctx: RequestContext, tenantId: string, filters: { category?: string; search?: string }) {
  return withTenant(ctx, (tx) => {
    const baseWhere = {
      tenantId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" as const } } : {}),
    };
    if (ctx.role === "FRANCHISEE_USER") {
      return tx.asset.findMany({ where: { ...baseWhere, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    }
    return tx.asset.findMany({ where: baseWhere, orderBy: { createdAt: "desc" } });
  });
}

/** [K,F]: archive or mark deprecated. Deprecated assets remain visible to admins, hidden from franchisees. */
export async function setAssetStatus(ctx: RequestContext, assetId: string, status: "ARCHIVED" | "DEPRECATED" | "ACTIVE") {
  return withTenant(ctx, async (tx) => {
    const before = await tx.asset.findUnique({ where: { id: assetId } });
    if (!before) throw new HttpError(404, "Asset not found");

    const after = await tx.asset.update({ where: { id: assetId }, data: { status } });

    await writeAuditLog(tx, {
      tenantId: after.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "asset.statusChange",
      entity: "Asset",
      entityId: assetId,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  });
}

/**
 * Signed download URL, expiring within 5 minutes (spec §14/§10.2). Franchisees
 * may only download ACTIVE assets in their own tenant; RLS enforces this too.
 */
export async function getAssetDownloadUrl(ctx: RequestContext, assetId: string): Promise<string> {
  const asset = await withTenant(ctx, (tx) => tx.asset.findUnique({ where: { id: assetId } }));
  if (!asset) throw new HttpError(404, "Asset not found");
  if (ctx.role === "FRANCHISEE_USER" && asset.status !== "ACTIVE") {
    throw new HttpError(404, "Asset not found");
  }
  return createPresignedDownloadUrl(asset.storageKey, 300);
}
