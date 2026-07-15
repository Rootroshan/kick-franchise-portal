import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseSearchParams } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";

const querySchema = z.object({
  period: z.enum(["MONTHLY", "QUARTERLY"]).optional(),
  tenantId: z.string().uuid().optional(),
});

/** KICK_ADMIN only — sales/rebate reports, exportable via csvStorageKey/pdfStorageKey signed downloads. */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const { period, tenantId } = parseSearchParams(req.url, querySchema);

  const reports = await withTenant(ctx, (tx) =>
    tx.rebateReport.findMany({
      where: { ...(period ? { period } : {}), ...(tenantId ? { tenantId } : {}) },
      orderBy: { generatedAt: "desc" },
    })
  );

  return Response.json({ reports });
});
