import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { uploadTemporaryBrandLogo } from "@/server/modules/tenants/brandProvisioning";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * Uploads a new-brand logo in one request — the browser posts the file
 * directly to our server (multipart/form-data), which relays it to R2
 * itself. See app/api/assets/upload/route.ts for why: a presigned-URL PUT
 * requires R2 bucket CORS configured for this origin, which wasn't set up;
 * a server-to-server PUT is never subject to CORS.
 */
export const POST = withErrorHandling(async (req) => {
  await requireRole("KICK_ADMIN")();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file is required");

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await uploadTemporaryBrandLogo(file.type, file.size, bytes);
  return Response.json(result);
});
