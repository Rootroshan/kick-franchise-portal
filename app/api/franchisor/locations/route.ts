import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { listLocations } from "@/server/modules/tenants/service";

/**
 * FRANCHISOR_ADMIN only — lists locations for the caller's OWN resolved
 * tenant (ctx.tenantId from the Host header). Needed for the Tasks
 * location-assignment UI; never accepts a tenantId param from the request.
 */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const locations = await listLocations(ctx, ctx.tenantId!);
  return Response.json({ locations });
});
