import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { checkout } from "@/server/modules/commerce/checkout";
import { checkoutRequestSchema } from "@/server/modules/commerce/schemas";

/** FRANCHISEE_USER only. See src/server/modules/commerce/checkout.ts for the full transaction. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const input = await parseJsonBody(req, checkoutRequestSchema);
  const result = await checkout(ctx, ctx.tenantId!, input);
  return Response.json(result, { status: 201 });
});
