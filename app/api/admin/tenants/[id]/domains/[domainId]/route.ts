import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { removeCustomDomain } from "@/server/modules/tenants/service";

/** [K]: removes a custom domain and detaches it from the hosting project. */
export const DELETE = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const domainId = parts[parts.length - 1]!; // .../domains/:domainId
  const result = await removeCustomDomain(ctx, domainId);
  return Response.json(result);
});
