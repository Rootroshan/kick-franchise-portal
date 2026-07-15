import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { requestAssetUpload } from "@/server/modules/assets/service";

const requestSchema = z.object({ mime: z.string().min(1), sizeBytes: z.number().int().positive() });

/** [K,F]: obtain a presigned PUT URL before uploading a new asset. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const input = await parseJsonBody(req, requestSchema);
  const result = await requestAssetUpload(ctx, ctx.tenantId!, input.mime, input.sizeBytes);
  return Response.json(result);
});
