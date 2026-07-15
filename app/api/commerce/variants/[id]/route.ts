import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { updateVariant } from "@/server/modules/commerce/products";
import { updateVariantSchema } from "@/server/modules/commerce/schemas";

export const PATCH = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const id = new URL(req.url).pathname.split("/").pop()!;
  const input = await parseJsonBody(req, updateVariantSchema);
  const variant = await updateVariant(ctx, id, input);
  return Response.json({ variant });
});
