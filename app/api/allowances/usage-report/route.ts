import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getAllowanceUsageReport } from "@/server/modules/allowances/admin";

/**
 * KICK_ADMIN only. Required deliverable per spec §6/§11.1 — franchisors
 * fund allowances, Kick bills them, so this report drives billing.
 */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? undefined;
  const report = await getAllowanceUsageReport(ctx, tenantId);
  return Response.json({ report });
});
