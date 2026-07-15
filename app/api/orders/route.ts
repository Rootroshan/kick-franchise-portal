import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";

/**
 * [K,U]: KICK_ADMIN sees all orders (cross-tenant via withTenant + RLS);
 * FRANCHISEE_USER sees only their own location's orders (RLS-enforced via
 * app.location_id). FRANCHISOR_ADMIN is never allowed here — requireRole()
 * rejects it with 403 before this handler's body executes.
 */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISEE_USER")();

  const orders = await withTenant(ctx, (tx) =>
    tx.order.findMany({
      where: ctx.role === "FRANCHISEE_USER" ? { locationId: ctx.locationId! } : undefined,
      include: { lines: { include: { variant: true } }, location: true },
      orderBy: { createdAt: "desc" },
    })
  );

  return Response.json({ orders });
});
