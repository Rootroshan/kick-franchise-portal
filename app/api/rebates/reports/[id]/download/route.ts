import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseSearchParams } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { createPresignedDownloadUrl } from "@/server/lib/storage";

const querySchema = z.object({ format: z.enum(["csv", "pdf"]) });

/** KICK_ADMIN only — signed download link for a generated rebate report. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 2]!; // .../reports/:id/download
  const { format } = parseSearchParams(req.url, querySchema);

  const report = await withTenant(ctx, (tx) => tx.rebateReport.findUnique({ where: { id } }));
  if (!report) throw new HttpError(404, "Report not found");

  const key = format === "csv" ? report.csvStorageKey : report.pdfStorageKey;
  if (!key) throw new HttpError(404, `No ${format} export available for this report`);

  const url = await createPresignedDownloadUrl(key, 300);
  return Response.json({ url, expiresInSeconds: 300 });
});
