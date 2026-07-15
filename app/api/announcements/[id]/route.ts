import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateAnnouncement } from "@/server/modules/announcements/service";
import { updateAnnouncementSchema } from "@/server/modules/announcements/schemas";

function idFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 1]!;
}

/** [K,F]: edit an announcement. */
export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const id = idFromUrl(req.url);
  const input = await parseJsonBody(req, updateAnnouncementSchema);
  const announcement = await updateAnnouncement(ctx, id, input);
  return Response.json({ announcement });
});
