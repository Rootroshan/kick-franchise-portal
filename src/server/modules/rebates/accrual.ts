import type { Prisma } from "@prisma/client";

/**
 * FLAT rebate: value (cents) * qty.
 * PERCENT rebate: round(unitPriceCents * qty * value / 10000), value in basis points.
 * Uses banker-free standard rounding (round-half-up) on integer cents — this
 * must never touch floating point for the money value itself; the division
 * happens on integers and Math.round operates on the resulting number, whose
 * precision loss (if any) is bounded to sub-cent artifacts that round away.
 */
export function computeRebateAmountCents(type: "FLAT" | "PERCENT", value: number, unitPriceCents: number, qty: number): number {
  if (type === "FLAT") {
    return value * qty;
  }
  // PERCENT: value is basis points (500 = 5%)
  return Math.round((unitPriceCents * qty * value) / 10000);
}

/**
 * Accrues rebates for every line of an order once it reaches PAID. Must run
 * inside the same transaction/flow that marks the order PAID (see Stripe
 * webhook handler), and is protected against duplicate accrual on duplicate
 * webhook delivery by the @@unique([orderLineId, rebateRuleId]) constraint —
 * a second attempt at the same accrual throws a unique-constraint error,
 * which the caller catches and ignores (already accrued).
 */
export async function accrueRebatesForOrder(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { include: { variant: { include: { product: true } } } } },
  });

  const accrued: Array<{ orderLineId: string; rebateRuleId: string; amountCents: number }> = [];

  for (const line of order.lines) {
    const productId = line.variant.productId;
    const rules = await tx.rebateRule.findMany({
      where: {
        productId,
        effectiveFrom: { lte: order.createdAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: order.createdAt } }],
      },
    });

    for (const rule of rules) {
      const amountCents = computeRebateAmountCents(rule.type, rule.value, line.unitPriceCents, line.qty);
      if (amountCents <= 0) continue;

      try {
        await tx.rebateAccrual.create({
          data: {
            tenantId: order.tenantId,
            orderLineId: line.id,
            rebateRuleId: rule.id,
            amountCents,
          },
        });
        accrued.push({ orderLineId: line.id, rebateRuleId: rule.id, amountCents });
      } catch (err: unknown) {
        // P2002 = unique constraint violation -> already accrued for this
        // line+rule (duplicate webhook delivery). Safe to ignore.
        const code = (err as { code?: string })?.code;
        if (code !== "P2002") throw err;
      }
    }
  }

  return accrued;
}
