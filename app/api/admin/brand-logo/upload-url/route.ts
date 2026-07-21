import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { requestTemporaryBrandLogo } from "@/server/modules/tenants/brandProvisioning";

const schema = z.object({ mime: z.string().min(1), sizeBytes: z.number().int().positive() });

export const POST = withErrorHandling(async (req) => {
  await requireRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, schema);
  return Response.json(await requestTemporaryBrandLogo(input.mime, input.sizeBytes));
});
