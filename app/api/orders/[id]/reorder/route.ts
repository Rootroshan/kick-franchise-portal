import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { prepareReorder } from "@/server/modules/commerce/storeOrders";

/**
 * Validates an old order against the CURRENT catalog (existence, active,
 * tenant, stock) and returns current-priced items for the client cart, plus
 * a clear list of anything unavailable. Never reuses historical prices and
 * never submits a checkout — the user reviews the cart first.
 */
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withErrorHandling(async () => {
    const ctx = await requireRole("FRANCHISEE_USER")();
    const result = await prepareReorder(ctx, params.id);
    return Response.json(result);
  })(req);
