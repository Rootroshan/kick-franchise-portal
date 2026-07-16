import { requireRole, requireTenantRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createAnnouncement, listAnnouncements } from "@/server/modules/announcements/service";
import { createAnnouncementSchema } from "@/server/modules/announcements/schemas";

/** [K,F,U]: franchisee/franchisor see their tenant's; Kick sees all. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN", "FRANCHISEE_USER")();
  const announcements = await listAnnouncements(ctx, ctx.tenantId);
  return Response.json({ announcements });
});

/** [K,F]: create/schedule an announcement. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireTenantRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, createAnnouncementSchema);
  const announcement = await createAnnouncement(ctx, ctx.tenantId, input);
  return Response.json({ announcement }, { status: 201 });
});
