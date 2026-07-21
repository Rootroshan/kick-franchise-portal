import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { createBrandSchema } from "@/server/modules/tenants/schemas";
import { provisionBrand } from "@/server/modules/tenants/brandProvisioning";

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, createBrandSchema);
  const result = await provisionBrand(ctx, input);
  return Response.json(result, { status: 201 });
});
