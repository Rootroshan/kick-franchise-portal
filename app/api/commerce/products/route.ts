import { requireRole, requireTenantRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createProduct, listProducts } from "@/server/modules/commerce/products";
import { createProductSchema } from "@/server/modules/commerce/schemas";

/**
 * KICK_ADMIN only. requireRole() throws a 403 BEFORE any commerce query
 * runs — a FRANCHISOR_ADMIN token never reaches listProducts/createProduct.
 */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("KICK_ADMIN")();
  const products = await listProducts(ctx, ctx.tenantId);
  return Response.json({ products });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireTenantRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createProductSchema);
  const product = await createProduct(ctx, ctx.tenantId, input);
  return Response.json({ product }, { status: 201 });
});
