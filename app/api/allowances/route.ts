import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { grantAllowance, listAllowances } from "@/server/modules/allowances/admin";
import { grantAllowanceSchema } from "@/server/modules/allowances/schemas";

/** KICK_ADMIN only — allowance administration. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN")();
  const allowances = await listAllowances(ctx, ctx.tenantId!);
  return Response.json({ allowances });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, grantAllowanceSchema);
  const allowance = await grantAllowance(ctx, ctx.tenantId!, input);
  return Response.json({ allowance }, { status: 201 });
});
