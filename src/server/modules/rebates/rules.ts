import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createRebateRuleSchema } from "./schemas";

/** KICK_ADMIN only. */
export async function createRebateRule(ctx: RequestContext, tenantId: string, input: z.infer<typeof createRebateRuleSchema>) {
  return withTenant(ctx, async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || product.tenantId !== tenantId) {
      throw new HttpError(404, "Product not found for this tenant");
    }

    const rule = await tx.rebateRule.create({
      data: {
        tenantId,
        productId: input.productId,
        type: input.type,
        value: input.value,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "rebateRule.create",
      entity: "RebateRule",
      entityId: rule.id,
      after: rule,
    });

    return rule;
  });
}

export async function listRebateRules(ctx: RequestContext, tenantId: string | null) {
  return withTenant(ctx, (tx) => tx.rebateRule.findMany({ where: { tenantId: tenantId ?? undefined }, include: { product: true } }));
}
