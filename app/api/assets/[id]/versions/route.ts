import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getAssetVersionHistory } from "@/server/modules/assets/service";

/** [K,F,U]: full version chain for an asset, oldest first. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../assets/:id/versions
  const versions = await getAssetVersionHistory(ctx, id);
  return Response.json({ versions });
});
