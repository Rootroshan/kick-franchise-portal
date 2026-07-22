import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { checkout } from "@/server/modules/commerce/checkout";
import { checkoutRequestSchema } from "@/server/modules/commerce/schemas";
import { notifyOrderEvent } from "@/server/modules/commerce/orderNotifications";

/** FRANCHISEE_USER only. See src/server/modules/commerce/checkout.ts for the full transaction. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const input = await parseJsonBody(req, checkoutRequestSchema);
  const result = await checkout(ctx, ctx.tenantId!, input);

  // After the transaction commits: confirmation notification(s). Deduplicated
  // per event, so an idempotent checkout retry never re-notifies.
  await notifyOrderEvent(result.orderId, "placed");
  if (result.status === "PAID") {
    // Allowance covered everything — there is no webhook to announce payment.
    await notifyOrderEvent(result.orderId, "paid");
  }

  return Response.json(result, { status: 201 });
});
