import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody, parseSearchParams } from "@/server/lib/apiHandler";
import { createAsset, listAssets } from "@/server/modules/assets/service";
import { createAssetUploadSchema, listAssetsQuerySchema } from "@/server/modules/assets/schemas";

/** [K,F,U]: list assets (franchisee sees ACTIVE only). */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const filters = parseSearchParams(req.url, listAssetsQuerySchema);
  const assets = await listAssets(ctx, ctx.tenantId!, filters);
  return Response.json({ assets });
});

/** [K,F]: finalize an asset record after a presigned upload completes. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, createAssetUploadSchema);
  const asset = await createAsset(ctx, ctx.tenantId!, input);
  return Response.json({ asset }, { status: 201 });
});
