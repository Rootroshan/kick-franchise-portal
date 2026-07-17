import { HttpError } from "@/server/modules/identity/errors";
import type { RequestContext } from "@/server/db/withTenant";

export type FranchisorContext = RequestContext & { tenantId: string; role: "FRANCHISOR_ADMIN" };

/**
 * Gate for every franchisor-dashboard read. Guarantees:
 *  - role is FRANCHISOR_ADMIN (KICK_ADMIN uses the /admin portal; giving Kick
 *    a franchisor view is an explicit impersonation feature, not this path)
 *  - a real tenantId is resolved (no apex/null tenant)
 * The dashboard module only ever touches non-commerce tables, and RLS is the
 * final backstop — this is the module-boundary + role layer.
 */
export function assertFranchisor(ctx: RequestContext): FranchisorContext {
  if (ctx.role !== "FRANCHISOR_ADMIN") {
    throw new HttpError(403, "This dashboard is only available to franchisor admins.");
  }
  if (!ctx.tenantId) {
    throw new HttpError(400, "No brand resolved for this session.");
  }
  return ctx as FranchisorContext;
}
