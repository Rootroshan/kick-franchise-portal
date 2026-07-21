import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody, parseSearchParams } from "@/server/lib/apiHandler";
import { createAsset, listAssets } from "@/server/modules/assets/service";
import { createAssetUploadSchema, listAssetsQuerySchema } from "@/server/modules/assets/schemas";
import { HttpError } from "@/server/modules/identity/errors";
import { withTenant } from "@/server/db/withTenant";

/** [K,F,U]: list assets (franchisee sees ACTIVE only). */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const filters = parseSearchParams(req.url, listAssetsQuerySchema);
  const assets = await listAssets(ctx, ctx.tenantId, filters);
  return Response.json({ assets });
});

const postBodySchema = createAssetUploadSchema.extend({
  // Only honored for KICK_ADMIN — a franchisor's asset always lands in their own tenant.
  tenantId: z.string().uuid().optional(),
});

/**
 * [K,F]: finalize an asset record after a presigned upload completes.
 * A FRANCHISOR_ADMIN may only upload into their own tenant (ctx.tenantId).
 * A KICK_ADMIN may upload into any brand by supplying `tenantId` explicitly —
 * never inferred from ctx, since Kick's own request context has no tenant
 * when browsing the cross-tenant Artwork Hub.
 */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, postBodySchema);

  let tenantId: string;
  if (ctx.role === "KICK_ADMIN") {
    if (!input.tenantId) throw new HttpError(400, "tenantId is required");
    const exists = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } }));
    if (!exists) throw new HttpError(404, "Brand not found");
    tenantId = input.tenantId;
  } else {
    if (!ctx.tenantId) throw new HttpError(400, "This action requires a resolved tenant");
    tenantId = ctx.tenantId;
  }

  const asset = await createAsset(ctx, tenantId, input);
  return Response.json({ asset }, { status: 201 });
});
