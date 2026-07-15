import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { verifyCustomDomain } from "@/server/modules/tenants/service";

/** [K]: attempts DNS TXT verification for a pending custom domain. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const domainId = parts[parts.length - 2]!; // .../domains/:domainId/verify
  const domain = await verifyCustomDomain(ctx, domainId);
  return Response.json({ domain });
});
