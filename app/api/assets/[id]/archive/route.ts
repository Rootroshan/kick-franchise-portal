import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { setAssetStatus } from "@/server/modules/assets/service";

/** [K]: archive an asset (hides from franchisees, retained for admins). Artwork is managed by Kick only. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../assets/:id/archive
  const asset = await setAssetStatus(ctx, id, "ARCHIVED");
  return Response.json({ asset });
});
