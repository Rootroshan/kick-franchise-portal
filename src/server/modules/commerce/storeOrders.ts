import type { OrderStatus, Prisma } from "@prisma/client";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { STATUS_BUCKETS, isDisplayStatus, type DisplayStatus } from "@/lib/orderStatus";
import { notifyKickAdminsCancellationRequest } from "./orderNotifications";

/**
 * Store-User-facing order queries. Every function requires a FRANCHISEE_USER
 * with an assigned location; every query is explicitly scoped to
 * (tenantId, locationId) on top of the RLS `order_access` policy —
 * defence-in-depth, matching checkout()'s style.
 */

function requireStoreCtx(ctx: RequestContext): { tenantId: string; locationId: string } {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId || !ctx.tenantId) {
    throw new HttpError(403, "Forbidden");
  }
  return { tenantId: ctx.tenantId, locationId: ctx.locationId };
}

export type StoreOrderListQuery = {
  status?: string; // DisplayStatus bucket
  q?: string; // order number ("1025" / "VS-1025") or product name / SKU
  from?: Date;
  to?: Date;
  sort?: "newest" | "oldest" | "total_desc" | "total_asc";
  page?: number;
  pageSize?: number;
};

export type StoreOrderRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: Date;
  subtotalCents: number;
  currency: string;
  itemCount: number;
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
};

export type StoreOrderSummary = {
  total: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
};

function listWhere(scope: { tenantId: string; locationId: string }, q: StoreOrderListQuery): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { tenantId: scope.tenantId, locationId: scope.locationId };

  if (q.status && isDisplayStatus(q.status)) {
    where.status = { in: STATUS_BUCKETS[q.status as DisplayStatus] };
  }
  if (q.from || q.to) {
    where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
  }
  if (q.q?.trim()) {
    const term = q.q.trim();
    // "VS-1025" or "1025" → order number; anything else → product name / SKU.
    // Matched against the OrderLine snapshot, not a live Product/ProductVariant
    // join — franchisee RLS only shows ACTIVE catalog rows, so a live join
    // would silently stop matching orders for since-deactivated products.
    const numeric = parseInt(term.replace(/^[A-Za-z]{1,3}-/, ""), 10);
    const or: Prisma.OrderWhereInput[] = [
      { lines: { some: { OR: [
        { productName: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { variantName: { contains: term, mode: "insensitive" } },
      ] } } },
    ];
    if (Number.isFinite(numeric)) or.push({ orderNumber: numeric });
    where.OR = or;
  }
  return where;
}

const SORTS: Record<NonNullable<StoreOrderListQuery["sort"]>, Prisma.OrderOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  total_desc: { subtotalCents: "desc" },
  total_asc: { subtotalCents: "asc" },
};

export async function listStoreOrders(
  ctx: RequestContext,
  q: StoreOrderListQuery
): Promise<{ rows: StoreOrderRow[]; total: number; page: number; pageSize: number }> {
  const scope = requireStoreCtx(ctx);
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, q.pageSize ?? 10));
  const where = listWhere(scope, q);

  return withTenant(ctx, async (tx) => {
    const [orders, total] = await Promise.all([
      tx.order.findMany({
        where,
        orderBy: SORTS[q.sort ?? "newest"],
        skip: (page - 1) * pageSize,
        take: pageSize,
        // List needs a line COUNT, never the lines themselves — no N+1, no over-fetch.
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          subtotalCents: true,
          currency: true,
          carrier: true,
          trackingNumber: true,
          estimatedDeliveryAt: true,
          deliveredAt: true,
          cancelledAt: true,
          refundedAt: true,
          _count: { select: { lines: true } },
        },
      }),
      tx.order.count({ where }),
    ]);

    const rows: StoreOrderRow[] = orders.map(({ _count, ...o }) => ({ ...o, itemCount: _count.lines }));
    return { rows, total, page, pageSize };
  });
}

/** Aggregate counts for the summary cards — one groupBy, mapped to display buckets. */
export async function getStoreOrderSummary(ctx: RequestContext): Promise<StoreOrderSummary> {
  const scope = requireStoreCtx(ctx);
  return withTenant(ctx, async (tx) => {
    const groups = await tx.order.groupBy({
      by: ["status"],
      where: { tenantId: scope.tenantId, locationId: scope.locationId },
      _count: { _all: true },
    });

    const count = (bucket: DisplayStatus) =>
      groups.filter((g) => (STATUS_BUCKETS[bucket] as OrderStatus[]).includes(g.status)).reduce((sum, g) => sum + g._count._all, 0);

    return {
      total: groups.reduce((sum, g) => sum + g._count._all, 0),
      processing: count("processing"),
      shipped: count("shipped"),
      delivered: count("delivered"),
      cancelled: count("cancelled"),
    };
  });
}

export type StoreOrderDetail = {
  id: string;
  orderNumber: number;
  brandName: string;
  storeName: string;
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  processingAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  estimatedDeliveryAt: Date | null;
  carrier: string | null;
  trackingNumber: string | null;
  cancellationRequestedAt: Date | null;
  subtotalCents: number;
  allowanceAppliedCents: number;
  cardChargedCents: number;
  refundedCents: number;
  currency: string;
  lines: Array<{
    id: string;
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    imageUrl: string | null;
    qty: number;
    unitPriceCents: number;
  }>;
};

/**
 * One order, scoped to the caller's own (tenant, location). A forged id from
 * another store matches nothing → null → caller returns 404. Never exposes
 * Stripe ids, ledger internals, or another location's data.
 */
export async function getStoreOrderDetail(ctx: RequestContext, orderId: string): Promise<StoreOrderDetail | null> {
  const scope = requireStoreCtx(ctx);
  return withTenant(ctx, async (tx) => {
    const o = await tx.order.findFirst({
      where: { id: orderId, tenantId: scope.tenantId, locationId: scope.locationId },
      include: {
        tenant: { select: { name: true } },
        location: { select: { name: true } },
        // Display snapshot only — reorder eligibility is re-checked live via
        // prepareReorder(), which reads the RLS-filtered catalog itself.
        lines: { select: { id: true, variantId: true, qty: true, unitPriceCents: true, productName: true, variantName: true, sku: true, imageUrl: true } },
      },
    });
    if (!o) return null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      brandName: o.tenant.name,
      storeName: o.location.name,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      processingAt: o.processingAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
      refundedAt: o.refundedAt,
      estimatedDeliveryAt: o.estimatedDeliveryAt,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      cancellationRequestedAt: o.cancellationRequestedAt,
      subtotalCents: o.subtotalCents,
      allowanceAppliedCents: o.allowanceAppliedCents,
      cardChargedCents: o.cardChargedCents,
      refundedCents: o.refundedCents,
      currency: o.currency,
      lines: o.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId,
        productName: l.productName ?? "Product",
        variantName: l.variantName ?? "",
        sku: l.sku ?? "—",
        imageUrl: l.imageUrl,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      })),
    };
  });
}

export type ReorderItem = { variantId: string; productName: string; variantName: string; priceCents: number; qty: number };
export type ReorderResult = {
  available: ReorderItem[];
  unavailable: Array<{ productName: string; variantName: string; reason: string }>;
};

/**
 * Validates an old order's lines against the CURRENT catalog: product/variant
 * must still exist, be active, belong to this tenant, and have stock. Prices
 * are today's — the historical unitPriceCents snapshot is never reused for a
 * new order. Returns items for the client cart; checkout re-validates and
 * re-prices everything server-side anyway, so this is UX, not authority.
 */
export async function prepareReorder(ctx: RequestContext, orderId: string): Promise<ReorderResult> {
  const scope = requireStoreCtx(ctx);

  // Ownership check stays on the franchisee's own RLS context — an order the
  // caller doesn't own must 404 exactly like every other store endpoint.
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { id: orderId, tenantId: scope.tenantId, locationId: scope.locationId },
      select: { id: true, lines: { select: { variantId: true, qty: true } } },
    })
  );
  if (!order) throw new HttpError(404, "Order not found");

  // Catalog eligibility is checked with an unrestricted read: variant_read RLS
  // only shows ACTIVE rows to a FRANCHISEE_USER, so an inactive product would
  // silently vanish from a franchisee-scoped join instead of being reported
  // as "no longer available". Reading via system/KICK_ADMIN context here is
  // safe — the caller already proved they own this order above, and nothing
  // from this second query is trusted for money (checkout re-prices everything).
  return withTenant(systemKickContext(), async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: order.lines.map((l) => l.variantId) } },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const available: ReorderResult["available"] = [];
    const unavailable: ReorderResult["unavailable"] = [];

    for (const line of order.lines) {
      const variant = variantMap.get(line.variantId);
      if (!variant) {
        unavailable.push({ productName: "Product", variantName: "—", reason: "No longer available" });
        continue;
      }
      const { product } = variant;
      if (product.tenantId !== scope.tenantId || !product.active) {
        unavailable.push({ productName: product.name, variantName: variant.name, reason: "No longer available" });
      } else if (!variant.active) {
        unavailable.push({ productName: product.name, variantName: variant.name, reason: "This option is no longer offered" });
      } else if (variant.stock !== null && variant.stock < line.qty) {
        if (variant.stock > 0) {
          available.push({ variantId: variant.id, productName: product.name, variantName: variant.name, priceCents: variant.priceCents, qty: variant.stock });
          unavailable.push({ productName: product.name, variantName: variant.name, reason: `Only ${variant.stock} in stock (you ordered ${line.qty})` });
        } else {
          unavailable.push({ productName: product.name, variantName: variant.name, reason: "Out of stock" });
        }
      } else {
        available.push({ variantId: variant.id, productName: product.name, variantName: variant.name, priceCents: variant.priceCents, qty: line.qty });
      }
    }

    return { available, unavailable };
  });
}

/** Raw statuses a store may still ask to cancel from: payment not yet followed by fulfilment. */
const CANCELLATION_REQUESTABLE: OrderStatus[] = ["PENDING", "PAID"];

export function canRequestCancellation(order: { status: OrderStatus; cancellationRequestedAt: Date | null }): boolean {
  return CANCELLATION_REQUESTABLE.includes(order.status) && !order.cancellationRequestedAt;
}

/**
 * Store user asks to cancel. This NEVER changes the order status — it records
 * the request and alerts KICK_ADMIN, who decides (spec: manual approval).
 * Server-side state check, not client: shipped/delivered orders reject here
 * regardless of what any UI showed.
 */
export async function requestCancellation(ctx: RequestContext, orderId: string, reason?: string): Promise<void> {
  const scope = requireStoreCtx(ctx);
  await withTenant(ctx, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, tenantId: scope.tenantId, locationId: scope.locationId } });
    if (!order) throw new HttpError(404, "Order not found");
    if (!canRequestCancellation(order)) {
      throw new HttpError(409, "This order can no longer be cancelled", "CANCELLATION_NOT_ALLOWED");
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        cancellationRequestedAt: new Date(),
        cancellationRequestedBy: ctx.userId,
        cancellationReason: reason?.slice(0, 500) ?? null,
      },
    });

    await writeAuditLog(tx, {
      tenantId: scope.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "order.cancellationRequested",
      entity: "Order",
      entityId: order.id,
      after: { reason: reason ?? null },
    });
  });

  await notifyKickAdminsCancellationRequest(orderId);
}

export type OrderActivityItem = { id: string; orderId: string; orderNumber: number; label: string; at: Date };

/**
 * Real order events for the "Recent Activity" rail, derived from lifecycle
 * timestamps — no synthetic events, no audit ids or webhook payloads.
 */
export async function getRecentOrderActivity(ctx: RequestContext, limit = 6): Promise<OrderActivityItem[]> {
  const scope = requireStoreCtx(ctx);
  return withTenant(ctx, async (tx) => {
    const orders = await tx.order.findMany({
      where: { tenantId: scope.tenantId, locationId: scope.locationId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, orderNumber: true, createdAt: true, paidAt: true, shippedAt: true, deliveredAt: true, cancelledAt: true, refundedAt: true },
    });

    const events: OrderActivityItem[] = [];
    for (const o of orders) {
      const push = (label: string, at: Date | null) => {
        if (at) events.push({ id: `${o.id}-${label}`, orderId: o.id, orderNumber: o.orderNumber, label, at });
      };
      push("Order placed", o.createdAt);
      push("Payment completed", o.paidAt);
      push("Order shipped", o.shippedAt);
      push("Order delivered", o.deliveredAt);
      push("Order cancelled", o.cancelledAt);
      push("Refund completed", o.refundedAt);
    }
    return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  });
}
