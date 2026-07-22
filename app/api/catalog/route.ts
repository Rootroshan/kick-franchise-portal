import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getCatalogForLocation } from "@/server/modules/commerce/products";

/** FRANCHISEE_USER only — browses their own tenant's active catalog.
 *  Supports ?q= (name/SKU/category search) and ?category= filters. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const url = new URL(req.url);
  const products = await getCatalogForLocation(ctx, ctx.tenantId!, {
    q: url.searchParams.get("q")?.slice(0, 200) ?? undefined,
    category: url.searchParams.get("category")?.slice(0, 100) ?? undefined,
  });
  return Response.json({ products });
});
