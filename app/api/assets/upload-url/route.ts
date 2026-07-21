import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { requestAssetUpload } from "@/server/modules/assets/service";
import { HttpError } from "@/server/modules/identity/errors";
import { withTenant } from "@/server/db/withTenant";

const requestSchema = z.object({
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  // Only honored for KICK_ADMIN — a franchisor's asset always lands in their own tenant.
  tenantId: z.string().uuid().optional(),
});

/**
 * [K,F]: obtain a presigned PUT URL before uploading a new asset. A
 * FRANCHISOR_ADMIN may only target their own tenant; a KICK_ADMIN must
 * supply the target brand explicitly.
 */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, requestSchema);

  let tenantId: string;
  if (ctx.role === "KICK_ADMIN") {
    if (!input.tenantId) throw new HttpError(400, "tenantId is required");
    const exists = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } }));
    if (!exists) throw new HttpError(404, "Brand not found");
    tenantId = input.tenantId;
  } else {
    if (!ctx.tenantId) throw new HttpError(400, "This action requires a resolved tenant");
    tenantId = ctx.tenantId;
  }

  const result = await requestAssetUpload(ctx, tenantId, input.mime, input.sizeBytes);
  return Response.json(result);
});
