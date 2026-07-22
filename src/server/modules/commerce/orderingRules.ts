import type { Prisma } from "@prisma/client";
import { HttpError } from "@/server/modules/identity/errors";
import { STATUS_BUCKETS } from "@/lib/orderStatus";
import type { CartItem } from "./schemas";

/** Any order that counts as "recently placed" for cadence purposes — every
 *  status except cancelled/refunded/failed, so an order that has simply
 *  progressed through fulfilment (PROCESSING/SHIPPED/DELIVERED) still blocks
 *  a cadence-restricted reorder, same as this module's own STATUS_BUCKETS
 *  source of truth (src/lib/orderStatus.ts) already defines for display. */
const CADENCE_ACTIVE_STATUSES = [
  ...STATUS_BUCKETS.processing,
  ...STATUS_BUCKETS.shipped,
  ...STATUS_BUCKETS.delivered,
];

/**
 * Enforces per-location ordering rules server-side: which products a store
 * may order, min/max quantity, and order cadence (days between orders for
 * a given product). Must run inside the checkout transaction, never
 * trusting UI-side restriction alone (spec §10.5 acceptance criteria).
 */
export async function assertOrderingRulesSatisfied(
  tx: Prisma.TransactionClient,
  locationId: string,
  items: Array<CartItem & { productId: string }>
) {
  const rules = await tx.locationOrderingRule.findMany({ where: { locationId } });
  if (rules.length === 0) return; // no restrictions configured for this location

  const globalRules = rules.filter((r) => r.productId === null);
  const byProduct = new Map<string, typeof rules>();
  for (const rule of rules) {
    if (!rule.productId) continue;
    const list = byProduct.get(rule.productId) ?? [];
    list.push(rule);
    byProduct.set(rule.productId, list);
  }

  for (const item of items) {
    const applicable = [...globalRules, ...(byProduct.get(item.productId) ?? [])];
    for (const rule of applicable) {
      if (rule.minQty !== null && item.qty < rule.minQty) {
        throw new HttpError(422, `Quantity below minimum (${rule.minQty}) for one or more items`, "ORDERING_RULE_MIN");
      }
      if (rule.maxQty !== null && item.qty > rule.maxQty) {
        throw new HttpError(422, `Quantity exceeds maximum (${rule.maxQty}) for one or more items`, "ORDERING_RULE_MAX");
      }
      if (rule.cadenceDays !== null) {
        const cutoff = new Date(Date.now() - rule.cadenceDays * 24 * 60 * 60 * 1000);
        const recentOrder = await tx.orderLine.findFirst({
          where: {
            variant: { productId: item.productId },
            order: { locationId, createdAt: { gte: cutoff }, status: { in: CADENCE_ACTIVE_STATUSES } },
          },
        });
        if (recentOrder) {
          throw new HttpError(
            422,
            `This product can only be ordered every ${rule.cadenceDays} days for this location`,
            "ORDERING_RULE_CADENCE"
          );
        }
      }
    }
  }
}
