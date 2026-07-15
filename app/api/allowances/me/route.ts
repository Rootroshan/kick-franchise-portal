import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling } from "@/server/lib/apiHandler";
import { getOwnAllowanceBalance } from "@/server/modules/allowances/admin";

/** FRANCHISEE_USER only — their own location's balance. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const balances = await getOwnAllowanceBalance(ctx);
  return Response.json({ balances });
});
