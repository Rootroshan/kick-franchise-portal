import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { requestCancellation } from "@/server/modules/commerce/storeOrders";

const bodySchema = z.object({ reason: z.string().max(500).optional() });

/**
 * Store User cancellation REQUEST. The server decides eligibility
 * (PENDING/PAID before fulfilment only) and never lets the store change the
 * order status directly — KICK_ADMIN reviews and actions the request.
 */
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withErrorHandling(async (r) => {
    const ctx = await requireRole("FRANCHISEE_USER")();
    const { reason } = await parseJsonBody(r, bodySchema);
    await requestCancellation(ctx, params.id, reason);
    return Response.json({ ok: true });
  })(req);
