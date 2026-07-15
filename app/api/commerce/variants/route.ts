import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createVariant } from "@/server/modules/commerce/products";
import { createVariantSchema } from "@/server/modules/commerce/schemas";

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createVariantSchema);
  const variant = await createVariant(ctx, input);
  return Response.json({ variant }, { status: 201 });
});
