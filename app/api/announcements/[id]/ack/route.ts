import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { acknowledgeAnnouncement } from "@/server/modules/announcements/service";

/** [U]: idempotent acknowledgement. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../announcements/:id/ack
  const ack = await acknowledgeAnnouncement(ctx, id);
  return Response.json({ ack });
});
