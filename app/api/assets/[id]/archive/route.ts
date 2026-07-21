import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { setAssetStatus } from "@/server/modules/assets/service";
import { assertOwnsAssetIfFranchisor, assetIdFromActionPath } from "@/server/modules/assets/routeHelpers";

/** [K,F]: archive an asset (hides from franchisees, retained for admins). A franchisor may only archive their own brand's assets. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const id = assetIdFromActionPath(req.url);
  await assertOwnsAssetIfFranchisor(ctx, id);
  const asset = await setAssetStatus(ctx, id, "ARCHIVED");
  return Response.json({ asset });
});
