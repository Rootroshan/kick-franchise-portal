import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateProduct } from "@/server/modules/commerce/products";
import { updateProductSchema } from "@/server/modules/commerce/schemas";

export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const id = new URL(req.url).pathname.split("/").pop()!;
  const input = await parseJsonBody(req, updateProductSchema);
  const product = await updateProduct(ctx, id, input);
  return Response.json({ product });
});
