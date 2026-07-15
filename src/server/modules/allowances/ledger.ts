import type { Prisma } from "@prisma/client";

/**
 * Computes the current balance for an allowance from its append-only ledger.
 * The ledger sum IS the source of truth; balanceAfter on each row is a
 * cached snapshot for fast reads only — never trust it over a recomputation
 * when correctness matters (e.g. inside the checkout transaction).
 */
export async function computeAllowanceBalance(tx: Prisma.TransactionClient, allowanceId: string): Promise<number> {
  const allowance = await tx.allowance.findUniqueOrThrow({ where: { id: allowanceId } });
  const agg = await tx.allowanceLedger.aggregate({
    where: { allowanceId },
    _sum: { deltaCents: true },
  });
  return allowance.grantedCents + (agg._sum.deltaCents ?? 0);
}

/**
 * Locks the allowance row for update (SELECT ... FOR UPDATE) so concurrent
 * checkouts against the same allowance serialize instead of racing. Must be
 * called inside the same transaction that later inserts the debit ledger
 * entry and the order — see checkout.ts.
 */
export async function lockAllowanceForUpdate(
  tx: Prisma.TransactionClient,
  locationId: string,
  periodLabel: string
): Promise<{ id: string; grantedCents: number; overflow: "BLOCK" | "CHARGE_CARD"; currency: string } | null> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; grantedCents: number; overflow: "BLOCK" | "CHARGE_CARD"; currency: string }>
  >`
    SELECT id, "grantedCents", overflow, currency
    FROM "Allowance"
    WHERE "locationId" = ${locationId} AND "periodLabel" = ${periodLabel}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/** Appends a debit entry. Never call outside a transaction that already holds the row lock. */
export async function appendLedgerDebit(
  tx: Prisma.TransactionClient,
  params: { allowanceId: string; orderId: string; deltaCents: number; balanceAfter: number }
) {
  return tx.allowanceLedger.create({
    data: {
      allowanceId: params.allowanceId,
      orderId: params.orderId,
      deltaCents: -Math.abs(params.deltaCents),
      balanceAfter: params.balanceAfter,
      reason: "ORDER_DEBIT",
    },
  });
}

/** Appends a compensating credit entry for a refund/cancellation. Never edits the original debit row. */
export async function appendLedgerCredit(
  tx: Prisma.TransactionClient,
  params: { allowanceId: string; orderId: string | null; deltaCents: number; reason?: "REFUND_CREDIT" | "ADJUSTMENT" | "GRANT" }
) {
  const balanceAfter = (await computeAllowanceBalance(tx, params.allowanceId)) + Math.abs(params.deltaCents);
  return tx.allowanceLedger.create({
    data: {
      allowanceId: params.allowanceId,
      orderId: params.orderId,
      deltaCents: Math.abs(params.deltaCents),
      balanceAfter,
      reason: params.reason ?? "REFUND_CREDIT",
    },
  });
}
