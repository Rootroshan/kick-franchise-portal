import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createLocation, listLocations } from "@/server/modules/tenants/service";
import { createLocationSchema } from "@/server/modules/tenants/schemas";

function tenantIdFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 2]!; // .../tenants/:id/locations
}

/** [K]: list locations. (Franchisors manage locations indirectly; direct location CRUD is Kick-only in MVP.) */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const locations = await listLocations(ctx, tenantId);
  return Response.json({ locations });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const input = await parseJsonBody(req, createLocationSchema);
  const location = await createLocation(ctx, tenantId, input);
  return Response.json({ location }, { status: 201 });
});
