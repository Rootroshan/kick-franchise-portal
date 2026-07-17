import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { computeAllowanceBalance } from "./ledger";

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

    return Promise.all(
      allowances.map(async (a) => {
        const balanceCents = await computeAllowanceBalance(tx, a.id);
        const usedCents = a.ledger.filter((l) => l.reason === "ORDER_DEBIT").reduce((s, l) => s + Math.abs(l.deltaCents), 0);
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
      })
    );
  });
}
