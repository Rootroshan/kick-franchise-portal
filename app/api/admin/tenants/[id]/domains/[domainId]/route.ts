import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { removeCustomDomain, getLiveDomainStatus } from "@/server/modules/tenants/service";

/**
 * [K]: "Refresh Status" — re-queries the hosting provider live rather than
 * reading the DB status flag, so CNAME/SSL drift after the initial TXT
 * verification is visible instead of showing a stale VERIFIED badge.
 */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const domainId = parts[parts.length - 1]!; // .../domains/:domainId
  const result = await getLiveDomainStatus(ctx, domainId);
  return Response.json(result);
});

/** [K]: removes a custom domain and detaches it from the hosting project. */
export const DELETE = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const domainId = parts[parts.length - 1]!; // .../domains/:domainId
  const result = await removeCustomDomain(ctx, domainId);
  return Response.json(result);
});
