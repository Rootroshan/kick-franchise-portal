import { OrderStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

/* ============================== CATALOGUE ================================= */

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  active: boolean;
  brandName: string;
  brandSlug: string;
  variantCount: number;
  priceFromCents: number | null;
  createdAt: Date;
};

export type ProductListResult = { rows: ProductRow[]; total: number };

/** Cross-tenant product catalogue with variant counts + lowest price. KICK_ADMIN only. */
export async function listProductsAdmin(ctx: RequestContext, q: AdminListQuery): Promise<ProductListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { sku: { contains: q.search, mode: "insensitive" as const } }] } : {}),
      ...(q.status === "active" ? { active: true } : q.status === "inactive" ? { active: false } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const orderBy = q.sort === "name" ? { name: q.direction } : q.sort === "sku" ? { sku: q.direction } : { createdAt: q.direction };

    const [products, total] = await Promise.all([
      tx.product.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } }, variants: { select: { priceCents: true } } },
      }),
      tx.product.count({ where }),
    ]);

    const rows: ProductRow[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      active: p.active,
      brandName: p.tenant.name,
      brandSlug: p.tenant.slug,
      variantCount: p.variants.length,
      priceFromCents: p.variants.length ? Math.min(...p.variants.map((v) => v.priceCents)) : null,
      createdAt: p.createdAt,
    }));

    return { rows, total };
  });
}

export type CatalogueKpis = { products: number; activeProducts: number; variants: number };

export async function getCatalogueKpis(ctx: RequestContext): Promise<CatalogueKpis> {
  return withTenant(ctx, async (tx) => {
    const [products, activeProducts, variants] = await Promise.all([
      tx.product.count(),
      tx.product.count({ where: { active: true } }),
      tx.productVariant.count(),
    ]);
    return { products, activeProducts, variants };
  });
}

/* ================================ ORDERS ================================= */

const PAID: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];
const STATUS_VALUES = new Set(Object.values(OrderStatus) as string[]);

export type OrderRow = {
  id: string;
  status: string;
  subtotalCents: number;
  cardChargedCents: number;
  allowanceAppliedCents: number;
  refundedCents: number;
  brandName: string;
  storeName: string;
  createdAt: Date;
};

export type OrderListResult = { rows: OrderRow[]; total: number };

/** Cross-tenant order list with search (id prefix)/status/brand/sort/pagination. KICK_ADMIN only. */
export async function listOrdersAdmin(ctx: RequestContext, q: AdminListQuery): Promise<OrderListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { id: { startsWith: q.search } } : {}),
      ...(q.status && STATUS_VALUES.has(q.status) ? { status: q.status as OrderStatus } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const orderBy = q.sort === "total" ? { subtotalCents: q.direction } : q.sort === "status" ? { status: q.direction } : { createdAt: q.direction };

    const [orders, total] = await Promise.all([
      tx.order.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true } }, location: { select: { name: true } } },
      }),
      tx.order.count({ where }),
    ]);

    const rows: OrderRow[] = orders.map((o) => ({
      id: o.id,
      status: o.status,
      subtotalCents: o.subtotalCents,
      cardChargedCents: o.cardChargedCents,
      allowanceAppliedCents: o.allowanceAppliedCents,
      refundedCents: o.refundedCents,
      brandName: o.tenant.name,
      storeName: o.location.name,
      createdAt: o.createdAt,
    }));

    return { rows, total };
  });
}

export type OrderKpis = { total: number; paid: number; refunded: number; revenueCents: number };

export async function getOrderKpis(ctx: RequestContext): Promise<OrderKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, paid, refunded, agg] = await Promise.all([
      tx.order.count(),
      tx.order.count({ where: { status: { in: PAID } } }),
      tx.order.count({ where: { status: { in: [OrderStatus.REFUNDED, OrderStatus.PARTIALLY_REFUNDED] } } }),
      tx.order.aggregate({ _sum: { subtotalCents: true, refundedCents: true }, where: { status: { in: PAID } } }),
    ]);
    return { total, paid, refunded, revenueCents: (agg._sum.subtotalCents ?? 0) - (agg._sum.refundedCents ?? 0) };
  });
}

export type OrderDetail = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotalCents: number;
  cardChargedCents: number;
  allowanceAppliedCents: number;
  refundedCents: number;
  currency: string;
  brandName: string;
  storeName: string;
  placedBy: string;
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
  cancellationRequestedBy: string | null;
  cancellationReason: string | null;
  lines: Array<{ id: string; productName: string; variantName: string; qty: number; unitPriceCents: number }>;
  refundableCents: number;
};

/** One order with line items. KICK_ADMIN only. */
export async function getOrderById(ctx: RequestContext, id: string): Promise<OrderDetail> {
  return withTenant(ctx, async (tx) => {
    const o = await tx.order.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true } },
        location: { select: { name: true } },
        lines: { include: { variant: { include: { product: { select: { name: true } } } } } },
      },
    });
    if (!o) throw new HttpError(404, "Order not found");

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      subtotalCents: o.subtotalCents,
      cardChargedCents: o.cardChargedCents,
      allowanceAppliedCents: o.allowanceAppliedCents,
      refundedCents: o.refundedCents,
      currency: o.currency,
      brandName: o.tenant.name,
      storeName: o.location.name,
      placedBy: o.placedBy,
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
      cancellationRequestedBy: o.cancellationRequestedBy,
      cancellationReason: o.cancellationReason,
      lines: o.lines.map((l) => ({
        id: l.id,
        productName: l.variant.product.name,
        variantName: l.variant.name,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      })),
      // Only the card-charged portion is refundable here; allowance is ledger-reversed separately.
      refundableCents: Math.max(0, o.cardChargedCents - o.refundedCents),
    };
  });
}
