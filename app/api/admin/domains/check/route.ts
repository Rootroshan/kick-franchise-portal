import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { domainCheckSchema } from "@/server/modules/tenants/schemas";
import { checkPortalDomain } from "@/server/modules/tenants/brandProvisioning";

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, domainCheckSchema);
  return Response.json(await checkPortalDomain(ctx, input.domain));
});
