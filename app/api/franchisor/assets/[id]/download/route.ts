import { requireTenantRole } from "@/server/modules/identity/guard";
import { getAssetDownloadUrl } from "@/server/modules/assets/service";
import { withTenant } from "@/server/db/withTenant";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * [F] Franchisor download: returns a redirect to a 5-minute signed R2 URL.
 * Tenant-scoped — a franchisor can only download their own brand's assets.
 * The `asset.download` audit row (Artwork Downloads KPI) is written inside
 * getAssetDownloadUrl, the shared choke point for all download routes.
 */
export const GET = withErrorHandling(async (req: Request) => {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../assets/:id/download

  // Ownership check before minting a URL.
  const owned = await withTenant(ctx, (tx) => tx.asset.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } }));
  if (!owned) throw new HttpError(404, "Asset not found");

  const url = await getAssetDownloadUrl(ctx, id);
  return Response.redirect(url, 302);
});
