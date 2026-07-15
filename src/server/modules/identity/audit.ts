import type { Prisma, Role } from "@prisma/client";

/**
 * Writes an immutable audit record for a privileged action. AuditLog has no
 * UPDATE/DELETE policy in RLS (see prisma/rls.sql) — rows can only ever be
 * inserted, never edited or removed via the application role.
 *
 * MUST be called with the `tx` from the enclosing withTenant() transaction,
 * never the top-level `prisma` singleton — a separate connection has no
 * session GUCs set (they're transaction-local via SET LOCAL) and RLS will
 * reject the insert, or worse, it can race against the still-uncommitted
 * rows the audit entry references.
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: {
    tenantId: string | null;
    actorId: string;
    role: Role;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  }
) {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      role: entry.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? undefined : (entry.before as object),
      after: entry.after === undefined ? undefined : (entry.after as object),
      ip: entry.ip ?? null,
    },
  });
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
