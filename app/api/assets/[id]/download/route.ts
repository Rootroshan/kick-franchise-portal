import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getAssetDownloadUrl } from "@/server/modules/assets/service";

/** [K,F,U]: short-lived signed download URL (≤5 min). Never a permanent public URL. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../assets/:id/download
  const url = await getAssetDownloadUrl(ctx, id);
  return Response.json({ url, expiresInSeconds: 300 });
});
