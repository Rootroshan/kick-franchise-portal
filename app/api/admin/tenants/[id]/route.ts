import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateTenant } from "@/server/modules/tenants/service";
import { updateTenantSchema } from "@/server/modules/tenants/schemas";

export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 1]!;
  const input = await parseJsonBody(req, updateTenantSchema);
  const tenant = await updateTenant(ctx, id, input);
  return Response.json({ tenant });
});
