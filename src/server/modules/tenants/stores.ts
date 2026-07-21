import { OrderStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { authPrisma } from "@/server/db/authClient";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

const PAID: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];
const netRevenue = (o: { subtotalCents: number; refundedCents: number }) => o.subtotalCents - o.refundedCents;

export type StoreRow = {
  id: string;
  name: string;
  storeCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  managerEmail: string | null;
  status: string;
  brandName: string;
  brandSlug: string;
  memberCount: number;
  orderCount: number;
  revenueCents: number;
};

export type StoreListResult = { rows: StoreRow[]; total: number };

/** Cross-tenant store (location) list with search/status/sort/pagination + rollups. KICK_ADMIN only. */
export async function listStores(ctx: RequestContext, q: AdminListQuery): Promise<StoreListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const orderBy =
      q.sort === "name" ? { name: q.direction } : q.sort === "status" ? { status: q.direction } : { createdAt: q.direction };

    const [locations, total] = await Promise.all([
      tx.location.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: { tenant: { select: { name: true, slug: true } } } }),
      tx.location.count({ where }),
    ]);

    const ids = locations.map((l) => l.id);
    const [members, orders] = await Promise.all([
      tx.membership.groupBy({ by: ["locationId"], where: { locationId: { in: ids } }, _count: true }),
      tx.order.findMany({ where: { locationId: { in: ids } }, select: { locationId: true, status: true, subtotalCents: true, refundedCents: true } }),
    ]);

    const memberMap = new Map(members.map((m) => [m.locationId, m._count]));
    const orderCount = new Map<string, number>();
    const revenue = new Map<string, number>();
    for (const o of orders) {
      orderCount.set(o.locationId, (orderCount.get(o.locationId) ?? 0) + 1);
      if (PAID.includes(o.status)) revenue.set(o.locationId, (revenue.get(o.locationId) ?? 0) + netRevenue(o));
    }

    const rows: StoreRow[] = locations.map((l) => ({
      id: l.id,
      name: l.name,
      storeCode: l.storeCode,
      address: l.address,
      phone: l.phone,
      email: l.email,
      managerName: l.managerName,
      managerEmail: l.managerEmail,
      status: l.status,
      brandName: l.tenant.name,
      brandSlug: l.tenant.slug,
      memberCount: (memberMap.get(l.id) as number) ?? 0,
      orderCount: orderCount.get(l.id) ?? 0,
      revenueCents: revenue.get(l.id) ?? 0,
    }));

    return { rows, total };
  });
}

export type StoreKpis = { totalStores: number; activeStores: number; totalOrders: number; totalRevenueCents: number };

export async function getStoreKpis(ctx: RequestContext): Promise<StoreKpis> {
  return withTenant(ctx, async (tx) => {
    const [totalStores, activeStores, totalOrders, revenue] = await Promise.all([
      tx.location.count(),
      tx.location.count({ where: { status: "active" } }),
      tx.order.count(),
      tx.order.aggregate({ _sum: { subtotalCents: true, refundedCents: true }, where: { status: { in: PAID } } }),
    ]);
    const totalRevenueCents = (revenue._sum.subtotalCents ?? 0) - (revenue._sum.refundedCents ?? 0);
    return { totalStores, activeStores, totalOrders, totalRevenueCents };
  });
}

export type StoreDetail = {
  id: string;
  tenantId: string;
  name: string;
  storeCode: string | null;
  address: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  status: string;
  createdAt: Date;
  brandName: string;
  brandSlug: string;
  members: Array<{
    id: string;
    userId: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    storeRole: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>;
  recentOrders: Array<{ id: string; status: string; subtotalCents: number; createdAt: Date }>;
  orderCount: number;
  revenueCents: number;
};

/** Fetch one store by id, with its brand, members, and recent orders. KICK_ADMIN only. */
export async function getStoreById(ctx: RequestContext, id: string): Promise<StoreDetail> {
  return withTenant(ctx, async (tx) => {
    const l = await tx.location.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, slug: true } },
        memberships: true,
        orders: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, subtotalCents: true, refundedCents: true, createdAt: true } },
      },
    });
    if (!l) throw new HttpError(404, "Store not found");

    const allOrders = await tx.order.findMany({ where: { locationId: id }, select: { status: true, subtotalCents: true, refundedCents: true } });
    const revenueCents = allOrders.filter((o) => PAID.includes(o.status)).reduce((s, o) => s + netRevenue(o), 0);

    // Membership only holds role/scope — account status, phone, and last
    // login live on User (a separate deny-all-RLS table), so members are
    // joined here rather than read purely off the Membership row.
    const userIds = l.memberships.map((m) => m.clerkUserId);
    const users = userIds.length
      ? await authPrisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      id: l.id,
      tenantId: l.tenantId,
      name: l.name,
      storeCode: l.storeCode,
      address: l.address,
      addressLine1: l.addressLine1,
      addressCity: l.addressCity,
      addressState: l.addressState,
      addressPostalCode: l.addressPostalCode,
      addressCountry: l.addressCountry,
      phone: l.phone,
      email: l.email,
      managerName: l.managerName,
      managerEmail: l.managerEmail,
      managerPhone: l.managerPhone,
      status: l.status,
      createdAt: l.createdAt,
      brandName: l.tenant.name,
      brandSlug: l.tenant.slug,
      members: l.memberships.map((m) => {
        const u = userMap.get(m.clerkUserId);
        return {
          id: m.id,
          userId: m.clerkUserId,
          displayName: m.displayName,
          email: m.email,
          phone: u?.phone ?? null,
          role: m.role,
          storeRole: m.storeRole,
          isActive: u?.isActive ?? true,
          lastLoginAt: u?.lastLoginAt ?? null,
          createdAt: u?.createdAt ?? m.createdAt,
        };
      }),
      recentOrders: l.orders.map((o) => ({ id: o.id, status: o.status, subtotalCents: o.subtotalCents, createdAt: o.createdAt })),
      orderCount: allOrders.length,
      revenueCents,
    };
  });
}

/** Distinct brand options for the store-list brand filter. */
export async function getBrandFilterOptions(ctx: RequestContext): Promise<Array<{ value: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const brands = await tx.tenant.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } });
    return brands.map((b) => ({ value: b.slug, label: b.name }));
  });
}
