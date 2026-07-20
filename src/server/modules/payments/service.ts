import { withTenant, type RequestContext } from "@/server/db/withTenant";

/**
 * Payments is a read-only projection over Order — deliberately NOT a separate
 * table. Stripe is the source of truth for money movement; these rows record
 * what we authorised. A parallel Payment table would be a second ledger that
 * can silently disagree with both.
 *
 * KICK_ADMIN only. Order carries the commerce RLS policy that already denies
 * FRANCHISOR_ADMIN, so a franchisor reaching this code reads zero rows even if
 * an app-layer guard were somehow missed.
 */

export type PaymentRow = {
  orderId: string;
  status: string;
  tenantName: string;
  locationName: string;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  refundedCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  createdAt: Date;
};

export type PaymentKpis = {
  cardVolumeCents: number;
  allowanceVolumeCents: number;
  refundedCents: number;
  failedCount: number;
};

export type PaymentQuery = { search?: string; status?: string; brand?: string; page: number; limit: number };

export async function listPayments(
  ctx: RequestContext,
  q: PaymentQuery
): Promise<{ rows: PaymentRow[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.brand) where.tenantId = q.brand;

  const search = q.search?.trim();
  if (search) {
    // Order id or Stripe reference — the two identifiers an operator has to
    // hand when chasing a specific payment.
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { stripePaymentIntentId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [orders, total] = await withTenant(ctx, async (tx) => {
    return Promise.all([
      tx.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true } }, location: { select: { name: true } } },
      }),
      tx.order.count({ where }),
    ]);
  });

  return {
    total,
    rows: orders.map((o) => ({
      orderId: o.id,
      status: o.status,
      tenantName: o.tenant.name,
      locationName: o.location.name,
      subtotalCents: o.subtotalCents,
      allowanceAppliedCents: o.allowanceAppliedCents,
      cardChargedCents: o.cardChargedCents,
      refundedCents: o.refundedCents,
      currency: o.currency,
      stripePaymentIntentId: o.stripePaymentIntentId,
      createdAt: o.createdAt,
    })),
  };
}

export async function getPaymentKpis(ctx: RequestContext): Promise<PaymentKpis> {
  return withTenant(ctx, async (tx) => {
    const [sums, failedCount] = await Promise.all([
      tx.order.aggregate({
        _sum: { cardChargedCents: true, allowanceAppliedCents: true, refundedCents: true },
      }),
      tx.order.count({ where: { status: "FAILED" } }),
    ]);

    return {
      cardVolumeCents: sums._sum.cardChargedCents ?? 0,
      allowanceVolumeCents: sums._sum.allowanceAppliedCents ?? 0,
      refundedCents: sums._sum.refundedCents ?? 0,
      failedCount,
    };
  });
}

/** Whether Stripe webhooks are being received — surfaced as delivery health. */
export async function getWebhookHealth(ctx: RequestContext): Promise<{ processed: number; lastAt: Date | null }> {
  return withTenant(ctx, async (tx) => {
    const [processed, latest] = await Promise.all([
      tx.processedStripeEvent.count(),
      tx.processedStripeEvent.findFirst({ orderBy: { processedAt: "desc" }, select: { processedAt: true } }),
    ]);
    return { processed, lastAt: latest?.processedAt ?? null };
  });
}
