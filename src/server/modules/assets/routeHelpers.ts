import type { RequestContext } from "@/server/db/withTenant";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * A FRANCHISOR_ADMIN may only act on assets in their own tenant. KICK_ADMIN
 * acts cross-tenant, so this is a no-op for them. Throws 404 (not 403) so a
 * franchisor guessing another brand's asset id learns nothing about whether
 * it exists.
 */
export async function assertOwnsAssetIfFranchisor(ctx: RequestContext, assetId: string): Promise<void> {
  if (ctx.role !== "FRANCHISOR_ADMIN") return;
  if (!ctx.tenantId) throw new HttpError(403, "This action requires a resolved tenant");
  const owned = await withTenant(ctx, (tx) => tx.asset.findFirst({ where: { id: assetId, tenantId: ctx.tenantId! }, select: { id: true } }));
  if (!owned) throw new HttpError(404, "Asset not found");
}

/** Extracts the `:id` segment for routes shaped `.../assets/:id/<action>`. */
export function assetIdFromActionPath(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 2]!;
}
