import type { Role } from "@prisma/client";
import type { RequestContext } from "@/server/db/withTenant";
import { getRequestContext } from "./requestContext";
import { HttpError } from "./errors";

/**
 * Layer 2 of the franchisor lockout: every commerce/allowance/rebate route
 * handler wraps its logic in requireRole('KICK_ADMIN'). A non-Kick token
 * gets a 403 BEFORE any business logic or database query executes — the
 * throw happens synchronously after the role check, prior to any
 * withTenant()/prisma call in the caller.
 *
 * Usage:
 *   export async function POST(req: Request) {
 *     const ctx = await requireRole("KICK_ADMIN")();
 *     // ... only reachable if ctx.role === "KICK_ADMIN"
 *   }
 */
export function requireRole(...allowed: Role[]) {
  return async function (): Promise<RequestContext> {
    const ctx = await getRequestContext();
    if (!allowed.includes(ctx.role)) {
      throw new HttpError(403, "Forbidden");
    }
    return ctx;
  };
}

/** Any authenticated + tenant-resolved user, regardless of role. */
export async function requireAnyRole(): Promise<RequestContext> {
  return getRequestContext();
}

export type TenantScopedContext = RequestContext & { tenantId: string };

/**
 * Same as requireRole(), but additionally guarantees ctx.tenantId is a real
 * string — not null. A KICK_ADMIN browsing without a resolved tenant
 * subdomain has tenantId: null; every write/list route that scopes data to
 * "the current tenant" (products, tasks, allowances, etc.) needs a real
 * tenant to act on, so this rejects with 400 instead of letting a `!`
 * non-null assertion silently pass `null` through to a Prisma `where`/`data`
 * clause, which throws a much less clear runtime error deep in a query.
 */
export function requireTenantRole(...allowed: Role[]) {
  return async function (): Promise<TenantScopedContext> {
    const ctx = await getRequestContext();
    if (!allowed.includes(ctx.role)) {
      throw new HttpError(403, "Forbidden");
    }
    if (!ctx.tenantId) {
      throw new HttpError(400, "This action requires a resolved tenant — access it from a brand subdomain or custom domain, not the apex domain");
    }
    return ctx as TenantScopedContext;
  };
}
