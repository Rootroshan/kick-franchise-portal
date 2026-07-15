import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createTenant, listTenants } from "@/server/modules/tenants/service";
import { createTenantSchema } from "@/server/modules/tenants/schemas";

/** KICK_ADMIN only — cross-tenant platform administration. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenants = await listTenants(ctx);
  return Response.json({ tenants });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createTenantSchema);
  const tenant = await createTenant(ctx, input);
  return Response.json({ tenant }, { status: 201 });
});
