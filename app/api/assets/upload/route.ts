import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { uploadAsset } from "@/server/modules/assets/service";
import { directAssetUploadMetaSchema } from "@/server/modules/assets/schemas";
import { HttpError } from "@/server/modules/identity/errors";
import { withTenant } from "@/server/db/withTenant";

const metaSchema = directAssetUploadMetaSchema.extend({
  // Only honored for KICK_ADMIN — a franchisor's asset always lands in their own tenant.
  tenantId: z.string().uuid().optional(),
});

/**
 * [K,F]: upload a new asset in one request — the browser posts the file
 * directly to our server (multipart/form-data), which relays it to R2
 * itself. Deliberately NOT a presigned-URL flow: that requires the R2
 * bucket's CORS policy to allow a direct browser PUT, which is an external
 * dashboard setting outside this app's control and wasn't configured for
 * this origin. A server-to-server R2 PUT is never subject to CORS.
 */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file is required");

  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") throw new HttpError(400, "meta is required");
  let metaJson: unknown;
  try {
    metaJson = JSON.parse(metaRaw);
  } catch {
    throw new HttpError(400, "Invalid JSON in meta field");
  }
  const parsed = metaSchema.safeParse(metaJson);
  if (!parsed.success) {
    throw new HttpError(400, `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`, "VALIDATION_ERROR");
  }
  const input = parsed.data;

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

  const bytes = Buffer.from(await file.arrayBuffer());
  const asset = await uploadAsset(ctx, tenantId, bytes, input);
  return Response.json({ asset }, { status: 201 });
});
