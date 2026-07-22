import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateAnnouncement } from "@/server/modules/announcements/service";
import { updateAnnouncementSchema } from "@/server/modules/announcements/schemas";

function idFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 1]!;
}

/**
 * [K,F]: edit an announcement. FRANCHISOR_ADMIN is pinned to their own
 * tenant; KICK_ADMIN may edit any tenant's announcement — same convention as
 * GET .../report and updateAnnouncementAction (see service.ts).
 */
export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const id = idFromUrl(req.url);
  const input = await parseJsonBody(req, updateAnnouncementSchema);
  const announcement = await updateAnnouncement(ctx, id, input, ctx.role === "FRANCHISOR_ADMIN" ? ctx.tenantId ?? undefined : undefined);
  return Response.json({ announcement });
});
