import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  assertValidUpload,
  storageObjectExists,
  uploadObjectDirect,
} from "@/server/lib/storage";
import type { z } from "zod";
import type { createAssetUploadSchema, directAssetUploadMetaSchema, updateAssetMetadataSchema } from "./schemas";

/** [K,F]: request a presigned PUT URL for a new asset upload. Validates mime/size before issuing. */
export async function requestAssetUpload(_ctx: RequestContext, tenantId: string, mime: string, sizeBytes: number) {
  assertValidUpload(mime, sizeBytes);
  const storageKey = `tenants/${tenantId}/assets/${crypto.randomUUID()}`;
  const uploadUrl = await createPresignedUploadUrl(storageKey, mime);
  return { uploadUrl, storageKey };
}

/**
 * [K,F]: upload the file straight through our server to R2 (server-to-server
 * PUT — not a browser-facing presigned URL, so R2 bucket CORS never applies)
 * and create the asset record in one step. Preferred over
 * requestAssetUpload+createAsset's two-step presigned flow, which requires
 * the R2 bucket to allow cross-origin PUTs from the browser.
 */
export async function uploadAsset(
  ctx: RequestContext,
  tenantId: string,
  file: Buffer,
  input: z.infer<typeof directAssetUploadMetaSchema>
) {
  assertValidUpload(input.mime, input.sizeBytes);
  if (file.byteLength !== input.sizeBytes) {
    throw new HttpError(422, "Uploaded file size does not match the declared size");
  }

  const storageKey = `tenants/${tenantId}/assets/${crypto.randomUUID()}`;
  await uploadObjectDirect(storageKey, input.mime, file);

  return createAssetRecord(ctx, tenantId, { ...input, storageKey });
}

/** [K,F]: finalize an asset record after the client has completed the presigned upload. */
export async function createAsset(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAssetUploadSchema>) {
  assertValidUpload(input.mime, input.sizeBytes);

  const exists = await storageObjectExists(input.storageKey);
  if (!exists) {
    throw new HttpError(422, "Upload did not complete — file not found in storage");
  }

  return createAssetRecord(ctx, tenantId, input);
}

async function createAssetRecord(ctx: RequestContext, tenantId: string, input: z.infer<typeof createAssetUploadSchema>) {
  return withTenant(ctx, async (tx) => {
    let version = 1;
    if (input.replacesId) {
      const previous = await tx.asset.findUnique({ where: { id: input.replacesId } });
      if (!previous || previous.tenantId !== tenantId) {
        throw new HttpError(404, "Asset being replaced was not found");
      }
      version = previous.version + 1;
      await tx.asset.update({ where: { id: previous.id }, data: { status: "ARCHIVED" } });
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
        status: input.publishActive === false ? "ARCHIVED" : "ACTIVE",
        replacesId: input.replacesId ?? null,
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
      after: { ...asset, versionNotes: input.versionNotes ?? null },
    });

    return asset;
  });
}

/** [K,F]: update an asset's name/category. Tenant-scoped; audit-logged. */
export async function updateAssetMetadata(ctx: RequestContext, assetId: string, input: z.infer<typeof updateAssetMetadataSchema>) {
  return withTenant(ctx, async (tx) => {
    const before = await tx.asset.findUnique({ where: { id: assetId } });
    if (!before) throw new HttpError(404, "Asset not found");

    const after = await tx.asset.update({
      where: { id: assetId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      },
    });

    await writeAuditLog(tx, {
      tenantId: after.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "asset.metadataUpdate",
      entity: "Asset",
      entityId: assetId,
      before: { name: before.name, category: before.category },
      after: { name: after.name, category: after.category },
    });

    return after;
  });
}

export type AssetVersionEntry = {
  id: string;
  version: number;
  name: string;
  mime: string;
  sizeBytes: number;
  status: string;
  createdAt: Date;
  createdBy: string;
  isCurrent: boolean;
};

/**
 * [K,F,U]: full version chain for an asset, oldest first. Walks `replacesId`
 * backward and forward from the given asset — there is no separate
 * AssetVersion table, versions are just Asset rows linked by replacesId.
 * Franchisees only ever see ACTIVE assets elsewhere, so a stale/expired link
 * they can't otherwise reach still 404s via the tenant-scoped lookup below.
 */
export async function getAssetVersionHistory(ctx: RequestContext, assetId: string): Promise<AssetVersionEntry[]> {
  if (ctx.role !== "KICK_ADMIN" && !ctx.tenantId) {
    throw new HttpError(403, "This action requires a resolved tenant");
  }

  return withTenant(ctx, async (tx) => {
    const anchor = await tx.asset.findFirst({
      where: { id: assetId, ...(ctx.role === "KICK_ADMIN" ? {} : { tenantId: ctx.tenantId! }) },
    });
    if (!anchor) throw new HttpError(404, "Asset not found");
    if (ctx.role === "FRANCHISEE_USER" && anchor.status !== "ACTIVE") {
      throw new HttpError(404, "Asset not found");
    }

    const chain = [anchor];

    // Walk backward via replacesId to the original upload.
    let cursor = anchor;
    while (cursor.replacesId) {
      const previous = await tx.asset.findUnique({ where: { id: cursor.replacesId } });
      if (!previous || previous.tenantId !== anchor.tenantId) break;
      chain.push(previous);
      cursor = previous;
    }

    // Walk forward to any asset that replaced this chain.
    cursor = anchor;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = await tx.asset.findFirst({ where: { replacesId: cursor.id, tenantId: anchor.tenantId } });
      if (!next) break;
      chain.push(next);
      cursor = next;
    }

    chain.sort((a, b) => a.version - b.version);
    const currentId = chain[chain.length - 1]?.id;

    return chain.map((a) => ({
      id: a.id,
      version: a.version,
      name: a.name,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      status: a.status,
      createdAt: a.createdAt,
      createdBy: a.createdBy,
      isCurrent: a.id === currentId,
    }));
  });
}

/**
 * [K,F]: promote an older row in the version chain back to current. There is
 * no settable "isCurrent" flag — the tail of the `replacesId` chain is what's
 * current — so this creates a new Asset row copying the target version's
 * file/metadata, chained via replacesId onto today's head, exactly like a
 * fresh upload in createAsset(). The old head is archived; the target row
 * itself is left untouched (it's still v-whatever in the chain).
 */
export async function promoteAssetVersion(ctx: RequestContext, assetId: string, targetVersionId: string) {
  if (ctx.role !== "KICK_ADMIN" && !ctx.tenantId) {
    throw new HttpError(403, "This action requires a resolved tenant");
  }

  return withTenant(ctx, async (tx) => {
    // Walk the chain in this same transaction — getAssetVersionHistory() opens
    // its own withTenant/$transaction, and nesting a second one here would
    // race the still-open outer transaction instead of seeing its writes.
    const anchor = await tx.asset.findFirst({
      where: { id: assetId, ...(ctx.role === "KICK_ADMIN" ? {} : { tenantId: ctx.tenantId! }) },
    });
    if (!anchor) throw new HttpError(404, "Asset not found");

    const chain = [anchor];
    let cursor = anchor;
    while (cursor.replacesId) {
      const previous = await tx.asset.findUnique({ where: { id: cursor.replacesId } });
      if (!previous || previous.tenantId !== anchor.tenantId) break;
      chain.push(previous);
      cursor = previous;
    }
    cursor = anchor;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = await tx.asset.findFirst({ where: { replacesId: cursor.id, tenantId: anchor.tenantId } });
      if (!next) break;
      chain.push(next);
      cursor = next;
    }
    chain.sort((a, b) => a.version - b.version);

    const target = chain.find((a) => a.id === targetVersionId);
    if (!target) throw new HttpError(404, "Version not found");
    const head = chain[chain.length - 1]!;
    if (head.id === targetVersionId) {
      throw new HttpError(422, "This version is already current");
    }

    await tx.asset.update({ where: { id: head.id }, data: { status: "ARCHIVED" } });

    const restored = await tx.asset.create({
      data: {
        tenantId: target.tenantId,
        name: target.name,
        type: target.type,
        category: target.category,
        storageKey: target.storageKey,
        mime: target.mime,
        sizeBytes: target.sizeBytes,
        version: head.version + 1,
        status: "ACTIVE",
        replacesId: head.id,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      tenantId: restored.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "asset.versionRestore",
      entity: "Asset",
      entityId: restored.id,
      before: { restoredFromVersionId: targetVersionId, restoredFromVersion: target.version },
      after: restored,
    });

    return restored;
  });
}

/** [K,F,U]: franchisees see only ACTIVE assets; admins see everything (incl. ARCHIVED/DEPRECATED). */
export async function listAssets(ctx: RequestContext, tenantId: string | null, filters: { category?: string; search?: string }) {
  return withTenant(ctx, (tx) => {
    const baseWhere = {
      tenantId: tenantId ?? undefined,
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
 * Every successful download writes an `asset.download` audit row here — the
 * single choke point all download routes go through — which feeds the
 * Artwork Hub "Total Downloads" KPI.
 */
export async function getAssetDownloadUrl(ctx: RequestContext, assetId: string): Promise<string> {
  const asset = await withTenant(ctx, async (tx) => {
    const a = await tx.asset.findUnique({ where: { id: assetId } });
    if (!a) throw new HttpError(404, "Asset not found");
    if (ctx.role === "FRANCHISEE_USER" && a.status !== "ACTIVE") {
      throw new HttpError(404, "Asset not found");
    }
    await writeAuditLog(tx, {
      tenantId: a.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "asset.download",
      entity: "Asset",
      entityId: a.id,
    });
    return a;
  });
  return createPresignedDownloadUrl(asset.storageKey, 300);
}
