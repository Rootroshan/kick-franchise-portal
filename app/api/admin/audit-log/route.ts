import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseSearchParams } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

/**
 * [K,F]: audit log viewer. RLS (audit_log_kick_read) is the actual
 * enforcement boundary — a FRANCHISOR_ADMIN session's query here will only
 * ever return rows for their own tenant, and never rows whose entity is a
 * commerce/allowance/rebate type, even if this handler's logic had a bug.
 */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const { entity, entityId, limit } = parseSearchParams(req.url, querySchema);

  const logs = await withTenant(ctx, (tx) =>
    tx.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  );

  return Response.json({ logs });
});
