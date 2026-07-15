import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createRebateRule, listRebateRules } from "@/server/modules/rebates/rules";
import { createRebateRuleSchema } from "@/server/modules/rebates/schemas";

/** KICK_ADMIN only. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN")();
  const rules = await listRebateRules(ctx, ctx.tenantId!);
  return Response.json({ rules });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createRebateRuleSchema);
  const rule = await createRebateRule(ctx, ctx.tenantId!, input);
  return Response.json({ rule }, { status: 201 });
});
