import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getCatalogForLocation } from "@/server/modules/commerce/products";

/** FRANCHISEE_USER only — browses their own tenant's active catalog. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const products = await getCatalogForLocation(ctx, ctx.tenantId!);
  return Response.json({ products });
});
