import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { balanceOf, usedOf } from "./listView";

/**
 * Read-only allowance view for a FRANCHISEE_USER's own store. RLS restricts
 * Allowance/AllowanceLedger to the caller's own location, but we also scope by
 * ctx.locationId in the query as defence-in-depth. Never grants/edits/deletes.
 */
export type StoreAllowance = {
  id: string;
  periodLabel: string;
  currency: string;
  grantedCents: number;
  usedCents: number;
  balanceCents: number;
  usagePercent: number;
  ledger: Array<{ id: string; deltaCents: number; balanceAfter: number; reason: string; createdAt: Date }>;
};

export async function getStoreAllowances(ctx: RequestContext): Promise<StoreAllowance[]> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users can view store allowance");
  }
  const locationId = ctx.locationId;

  return withTenant(ctx, async (tx) => {
    const allowances = await tx.allowance.findMany({
      where: { locationId },
      orderBy: { createdAt: "desc" },
      include: { ledger: { orderBy: { createdAt: "desc" } } },
    });

    // Balance/used are derived in-memory from the ledger rows already fetched
    // above — no per-allowance query needed (computeAllowanceBalance() exists
    // for the correctness-critical path inside checkout's transaction; this
    // is a read-only display view where the fetched ledger IS the same data).
    return allowances.map((a) => {
      const usedCents = usedOf(a.ledger);
      const balanceCents = balanceOf(a.grantedCents, a.ledger);
      const usagePercent = a.grantedCents > 0 ? Math.min(100, Math.round((usedCents / a.grantedCents) * 100)) : 0;
      return {
        id: a.id,
        periodLabel: a.periodLabel,
        currency: a.currency,
        grantedCents: a.grantedCents,
        usedCents,
        balanceCents,
        usagePercent,
        ledger: a.ledger.map((l) => ({ id: l.id, deltaCents: l.deltaCents, balanceAfter: l.balanceAfter, reason: l.reason, createdAt: l.createdAt })),
      };
    });
  });
}
