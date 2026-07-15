import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import type { Role } from "@prisma/client";

export type RequestContext = {
  tenantId: string | null;
  role: Role;
  locationId: string | null;
  userId: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_RE = /^[A-Z_]+$/;

function assertSafeUuidOrEmpty(value: string | null, label: string): string {
  if (value === null || value === "") return "";
  if (!UUID_RE.test(value)) {
    throw new Error(`Refusing to set ${label}: not a valid UUID`);
  }
  return value;
}

function assertSafeRole(value: string): string {
  if (!ROLE_RE.test(value)) {
    throw new Error(`Refusing to set app.user_role: unexpected value`);
  }
  return value;
}

/**
 * Runs `fn` inside a Postgres transaction with session GUCs set so RLS
 * policies (prisma/rls.sql) can evaluate them. This is the ONLY sanctioned
 * way to touch tenant-scoped tables — never query `prisma` directly outside
 * this wrapper for tenant data.
 *
 * Values are validated as UUIDs / role enum strings before interpolation.
 * `SET LOCAL` does not support bound parameters in Postgres, so validation
 * here is the injection defense — ctx fields must always come from a
 * verified Clerk session + Membership lookup + host resolution, never raw
 * user input.
 */
export async function withTenant<T>(
  ctx: RequestContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const tenantId = assertSafeUuidOrEmpty(ctx.tenantId, "app.tenant_id");
  const locationId = assertSafeUuidOrEmpty(ctx.locationId, "app.location_id");
  const role = assertSafeRole(ctx.role);
  const userId = ctx.userId.replace(/'/g, "");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_role = '${role}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.location_id = '${locationId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
    return fn(tx);
  });
}

/** Context for background jobs that must act with Kick-level authority. */
export function systemKickContext(): RequestContext {
  return { tenantId: null, role: "KICK_ADMIN", locationId: null, userId: "system-worker" };
}
