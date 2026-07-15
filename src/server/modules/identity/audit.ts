import { prisma } from "@/server/db/client";
import type { Role } from "@prisma/client";

/**
 * Writes an immutable audit record for a privileged action. AuditLog has no
 * UPDATE/DELETE policy in RLS (see prisma/rls.sql) — rows can only ever be
 * inserted, never edited or removed via the application role.
 */
export async function writeAuditLog(entry: {
  tenantId: string | null;
  actorId: string;
  role: Role;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
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
