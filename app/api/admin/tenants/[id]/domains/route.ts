import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createCustomDomain, listCustomDomains } from "@/server/modules/tenants/service";
import { createCustomDomainSchema } from "@/server/modules/tenants/schemas";

function tenantIdFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/");
  return parts[parts.length - 2]!; // .../tenants/:id/domains
}

/** [K]: list custom domains + verification status for this tenant. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const domains = await listCustomDomains(ctx, tenantId);
  return Response.json({ domains });
});

/** [K]: register a custom domain, returns DNS TXT instructions to set before verifying. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = tenantIdFromUrl(req.url);
  const input = await parseJsonBody(req, createCustomDomainSchema);
  const result = await createCustomDomain(ctx, tenantId, input);
  return Response.json(result, { status: 201 });
});
