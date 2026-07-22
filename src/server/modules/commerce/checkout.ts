import type { Prisma } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { lockAllowanceForUpdate, computeAllowanceBalance, appendLedgerDebit } from "@/server/modules/allowances/ledger";
import { assertOrderingRulesSatisfied } from "./orderingRules";
import { stripeClient } from "@/server/lib/stripe";
import type { CheckoutRequest } from "./schemas";

export type CheckoutResult = {
  orderId: string;
  status: string;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  clientSecret: string | null;
};

function currentPeriodLabel(date = new Date()): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/**
 * The concurrency-safe checkout transaction (tech spec §11.1).
 *
 * 1. Re-price every line from the CURRENT ProductVariant.priceCents — the
 *    client-sent cart only supplies variantId + qty, never a price or total.
 * 2. Enforce LocationOrderingRule server-side.
 * 3. Lock the location's active Allowance row FOR UPDATE inside this
 *    transaction so two simultaneous checkouts cannot both spend the same
 *    balance.
 * 4. balance = grantedCents + SUM(ledger.deltaCents); applied = min(balance, subtotal).
 * 5. remainder = subtotal - applied. If remainder > 0 and overflow=BLOCK,
 *    abort with 409. Otherwise (CHARGE_CARD, the confirmed default) create a
 *    Stripe PaymentIntent for the remainder cents.
 * 6. Insert Order (PENDING) + OrderLines with price snapshots.
 * 7. Insert the append-only AllowanceLedger debit row.
 * 8. Order remains PENDING until the Stripe webhook confirms payment (or is
 *    marked PAID immediately if remainder === 0, since no card step exists).
 *
 * Idempotency: `idempotencyKey` is unique on Order — a retried/duplicated
 * request with the same key returns the original order rather than double
 * charging or double-debiting.
 */
export async function checkout(ctx: RequestContext, tenantId: string, req: CheckoutRequest): Promise<CheckoutResult> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users may check out");
  }
  const locationId = ctx.locationId;

  return withTenant(ctx, async (tx) => {
    // Idempotency check: a retried/duplicated request with the same key
    // returns the original order rather than double charging or debiting.
    // Must run through tx (not the bare prisma client) — Order has FORCE
    // ROW LEVEL SECURITY and this needs the transaction's session GUCs.
    const raced = await tx.order.findUnique({ where: { idempotencyKey: req.idempotencyKey } });
    if (raced) {
      return {
        orderId: raced.id,
        status: raced.status,
        subtotalCents: raced.subtotalCents,
        allowanceAppliedCents: raced.allowanceAppliedCents,
        cardChargedCents: raced.cardChargedCents,
        clientSecret: null,
      };
    }

    // 1. Re-price server-side. Never trust any client-sent price/total.
    const variantIds = req.items.map((i) => i.variantId);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, active: true },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotalCents = 0;
    const lineInputs: Array<{
      variantId: string;
      qty: number;
      unitPriceCents: number;
      productId: string;
      productName: string;
      variantName: string;
      sku: string;
      imageUrl: string | null;
    }> = [];
    for (const item of req.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.product.tenantId !== tenantId || !variant.product.active) {
        throw new HttpError(422, `Product variant ${item.variantId} is not available`, "VARIANT_UNAVAILABLE");
      }
      if (variant.stock !== null && variant.stock < item.qty) {
        throw new HttpError(422, `Insufficient stock for ${variant.name}`, "INSUFFICIENT_STOCK");
      }
      subtotalCents += variant.priceCents * item.qty;
      lineInputs.push({
        variantId: variant.id,
        qty: item.qty,
        unitPriceCents: variant.priceCents,
        productId: variant.productId,
        // Snapshots: order history must keep rendering correctly even after
        // the product is later deactivated/renamed (franchisee RLS hides
        // inactive catalog rows from a live join).
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.product.sku,
        imageUrl: variant.product.imageUrl,
      });
    }
    if (subtotalCents <= 0) {
      throw new HttpError(422, "Cart subtotal must be positive", "INVALID_CART");
    }

    // 2. Ordering rules, enforced server-side.
    await assertOrderingRulesSatisfied(tx, locationId, lineInputs);

    // 3. Lock the active allowance row for this location/period.
    const periodLabel = currentPeriodLabel();
    const allowance = await lockAllowanceForUpdate(tx, locationId, periodLabel);

    let allowanceAppliedCents = 0;
    let remainderCents = subtotalCents;
    let allowanceId: string | null = null;

    if (allowance) {
      allowanceId = allowance.id;
      const balance = await computeAllowanceBalance(tx, allowance.id);
      const availableBalance = Math.max(0, balance);
      allowanceAppliedCents = Math.min(availableBalance, subtotalCents);
      remainderCents = subtotalCents - allowanceAppliedCents;

      if (remainderCents > 0 && allowance.overflow === "BLOCK") {
        throw new HttpError(409, "Insufficient allowance balance for this order", "ALLOWANCE_INSUFFICIENT");
      }
    }
    // If no allowance exists for this period, the full amount goes to card
    // (remainderCents already equals subtotalCents in that case).

    // Decrement tracked stock (untracked stock is null and skipped). The
    // conditional `stock >= qty` makes this safe under concurrency: the early
    // read-time check above can race with a parallel checkout, but two
    // transactions can't both satisfy this guard for the same units — the
    // loser matches zero rows and the whole transaction rolls back. Runs
    // BEFORE the Stripe call so a stock failure never leaves an orphaned
    // PaymentIntent behind.
    //
    // Sorted by variantId first: two carts sharing 2+ overlapping variants in
    // different orders (e.g. [A,B] vs [B,A]) would otherwise lock those rows
    // in opposite order and can genuinely deadlock in Postgres (40P01) — a raw,
    // uncaught error surfaced to the caller, not just a slow retry. A single
    // fixed lock-acquisition order across every checkout makes that class of
    // deadlock impossible; the allowance row lock above is already per-location
    // so it doesn't need the same treatment.
    const sortedLines = [...lineInputs].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const line of sortedLines) {
      const variant = variantMap.get(line.variantId)!;
      if (variant.stock !== null) {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.qty } },
          data: { stock: { decrement: line.qty } },
        });
        if (updated.count === 0) {
          throw new HttpError(422, `Insufficient stock for ${variant.name}`, "INSUFFICIENT_STOCK");
        }
      }
    }

    // 5. Create a Stripe PaymentIntent for the remainder, if any.
    let clientSecret: string | null = null;
    let stripePaymentIntentId: string | null = null;
    if (remainderCents > 0) {
      const intent = await (await stripeClient()).paymentIntents.create(
        {
          amount: remainderCents,
          currency: "cad",
          metadata: { tenantId, locationId, idempotencyKey: req.idempotencyKey },
        },
        { idempotencyKey: `pi_${req.idempotencyKey}` }
      );
      clientSecret = intent.client_secret;
      stripePaymentIntentId = intent.id;
    }

    // 6. Insert Order + OrderLines (price snapshots).
    const order = await tx.order.create({
      data: {
        tenantId,
        locationId,
        status: remainderCents > 0 ? "PENDING" : "PAID",
        // Allowance-only orders have no card leg, so payment is complete now;
        // card orders get paidAt stamped by the Stripe webhook.
        paidAt: remainderCents > 0 ? null : new Date(),
        subtotalCents,
        allowanceAppliedCents,
        cardChargedCents: 0, // set once the webhook confirms payment
        currency: "CAD",
        stripePaymentIntentId,
        idempotencyKey: req.idempotencyKey,
        placedBy: ctx.userId,
        lines: {
          create: lineInputs.map((l) => ({
            variantId: l.variantId,
            qty: l.qty,
            unitPriceCents: l.unitPriceCents,
            productName: l.productName,
            variantName: l.variantName,
            sku: l.sku,
            imageUrl: l.imageUrl,
          })),
        },
      },
    });

    // 7. Append-only allowance debit, tied to this order.
    if (allowanceId && allowanceAppliedCents > 0) {
      const balanceAfter = (await computeAllowanceBalance(tx, allowanceId)) - allowanceAppliedCents;
      await appendLedgerDebit(tx, {
        allowanceId,
        orderId: order.id,
        deltaCents: allowanceAppliedCents,
        balanceAfter,
      });
    }

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "order.checkout",
      entity: "Order",
      entityId: order.id,
      after: { subtotalCents, allowanceAppliedCents, remainderCents, status: order.status },
    });

    return {
      orderId: order.id,
      status: order.status,
      subtotalCents,
      allowanceAppliedCents,
      cardChargedCents: 0,
      clientSecret,
    };
  });
}

export type PrismaTx = Prisma.TransactionClient;
