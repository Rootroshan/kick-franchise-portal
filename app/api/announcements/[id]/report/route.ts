import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getAcknowledgementReport } from "@/server/modules/announcements/service";

/** [K,F]: per-location acknowledgement breakdown. FRANCHISOR_ADMIN is pinned to their own tenant; KICK_ADMIN may pull any tenant's report. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../announcements/:id/report
  const report = await getAcknowledgementReport(ctx, id, ctx.role === "FRANCHISOR_ADMIN" ? ctx.tenantId ?? undefined : undefined);
  return Response.json({ report });
});
