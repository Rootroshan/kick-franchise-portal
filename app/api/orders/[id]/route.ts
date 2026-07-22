import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getStoreOrderDetail } from "@/server/modules/commerce/storeOrders";

/**
 * One order, for the owning store only. The full chain: authenticated session
 * → membership + domain-resolved tenant (getRequestContext) → FRANCHISEE_USER
 * role (requireRole) → order.tenantId/locationId must equal the membership's
 * (getStoreOrderDetail's where clause + RLS). A guessed/other-store id falls
 * through to a plain 404 — indistinguishable from "no such order".
 */
export const GET = (req: Request, { params }: { params: { id: string } }) =>
  withErrorHandling(async () => {
    const ctx = await requireRole("FRANCHISEE_USER")();
    const order = await getStoreOrderDetail(ctx, params.id);
    if (!order) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ order });
  })(req);
