import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createMembership, listMemberships } from "@/server/modules/tenants/service";
import { createMembershipSchema } from "@/server/modules/tenants/schemas";

function tenantIdFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 2]!; // .../tenants/:id/members
}

/** [K,F]: list members of this tenant. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const members = await listMemberships(ctx, tenantId);
  return Response.json({ members });
});

/** [K,F]: invite/assign a user. Franchisor may only assign FRANCHISEE_USER (enforced in the service layer). */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const input = await parseJsonBody(req, createMembershipSchema);
  const membership = await createMembership(ctx, tenantId, input);
  return Response.json({ membership }, { status: 201 });
});
