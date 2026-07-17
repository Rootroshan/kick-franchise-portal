import { z } from "zod";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { requestAssetUpload } from "@/server/modules/assets/service";

const requestSchema = z.object({ mime: z.string().min(1), sizeBytes: z.number().int().positive() });

/** [K]: obtain a presigned PUT URL before uploading a new asset. Artwork is uploaded by Kick only. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireTenantRole("KICK_ADMIN")();
  const input = await parseJsonBody(req, requestSchema);
  const result = await requestAssetUpload(ctx, ctx.tenantId, input.mime, input.sizeBytes);
  return Response.json(result);
});
