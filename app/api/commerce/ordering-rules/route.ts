import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { createOrderingRuleSchema } from "@/server/modules/commerce/schemas";

/** KICK_ADMIN only — ordering rules are part of commerce configuration. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createOrderingRuleSchema);

  const rule = await withTenant(ctx, async (tx) => {
    const created = await tx.locationOrderingRule.create({
      data: {
        locationId: input.locationId,
        productId: input.productId ?? null,
        minQty: input.minQty ?? null,
        maxQty: input.maxQty ?? null,
        cadenceDays: input.cadenceDays ?? null,
      },
    });
    await writeAuditLog(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "orderingRule.create",
      entity: "LocationOrderingRule",
      entityId: created.id,
      after: created,
    });
    return created;
  });

  return Response.json({ rule }, { status: 201 });
});
