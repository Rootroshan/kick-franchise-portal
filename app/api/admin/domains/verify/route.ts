import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { domainCheckSchema } from "@/server/modules/tenants/schemas";
import { verifyPortalDomainDns } from "@/server/modules/tenants/brandProvisioning";

export const POST = withErrorHandling(async (req) => {
  await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, domainCheckSchema);
  return Response.json(await verifyPortalDomainDns(input.domain));
});
