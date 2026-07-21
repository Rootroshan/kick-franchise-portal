import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateAssetMetadata } from "@/server/modules/assets/service";
import { updateAssetMetadataSchema } from "@/server/modules/assets/schemas";
import { assertOwnsAssetIfFranchisor } from "@/server/modules/assets/routeHelpers";

/** [K,F]: edit an asset's name/category. A franchisor may only edit their own brand's assets. */
export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 1]!; // .../assets/:id
  await assertOwnsAssetIfFranchisor(ctx, id);
  const input = await parseJsonBody(req, updateAssetMetadataSchema);
  const asset = await updateAssetMetadata(ctx, id, input);
  return Response.json({ asset });
});
