import { OrderStatus } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

const PAID: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];
// Net revenue = paid subtotal minus refunds.
const netRevenue = (o: { subtotalCents: number; refundedCents: number }) => o.subtotalCents - o.refundedCents;

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  storeCount: number;
  memberCount: number;
  orderCount: number;
  revenueCents: number;
  /** Primary custom domain, if one is registered. */
  customDomain: string | null;
  /** PENDING | VERIFIED | FAILED, or null when no domain exists. */
  domainStatus: string | null;
  /** Brand theme, for the logo/initial avatar in the list. */
  theme: unknown;
};

export type BrandListResult = { rows: BrandRow[]; total: number };

/** Cross-tenant brand list with search/status filter/sort/pagination + rollups. KICK_ADMIN only. */
export async function listBrands(ctx: RequestContext, q: AdminListQuery): Promise<BrandListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { slug: { contains: q.search, mode: "insensitive" as const } },
              // Domains live on a related table, so this needs a relation
              // filter rather than another column comparison.
              { customDomains: { some: { hostname: { contains: q.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const orderBy =
      q.sort === "name"
        ? { name: q.direction }
        : q.sort === "status"
        ? { status: q.direction }
        : { createdAt: q.direction };

    const [tenants, total] = await Promise.all([
      tx.tenant.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit }),
      tx.tenant.count({ where }),
    ]);

    // Rollups per brand — grouped counts to avoid N+1.
    const ids = tenants.map((t) => t.id);
    const [stores, members, orders, domains] = await Promise.all([
      tx.location.groupBy({ by: ["tenantId"], where: { tenantId: { in: ids } }, _count: true }),
      tx.membership.groupBy({ by: ["tenantId"], where: { tenantId: { in: ids } }, _count: true }),
      tx.order.findMany({ where: { tenantId: { in: ids } }, select: { tenantId: true, status: true, subtotalCents: true, refundedCents: true } }),
      // One query mapped in memory, matching the rollup pattern above — an
      // include would issue a subquery per row.
      tx.customDomain.findMany({
        where: { tenantId: { in: ids } },
        select: { tenantId: true, hostname: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // First domain per tenant wins: a brand may register several, but the list
    // shows the primary one.
    const domainMap = new Map<string, { hostname: string; status: string }>();
    for (const d of domains) {
      if (!domainMap.has(d.tenantId)) domainMap.set(d.tenantId, { hostname: d.hostname, status: d.status });
    }

    const storeMap = new Map(stores.map((s) => [s.tenantId, s._count]));
    const memberMap = new Map(members.map((m) => [m.tenantId, m._count]));
    const orderCount = new Map<string, number>();
    const revenue = new Map<string, number>();
    for (const o of orders) {
      orderCount.set(o.tenantId, (orderCount.get(o.tenantId) ?? 0) + 1);
      if (PAID.includes(o.status)) revenue.set(o.tenantId, (revenue.get(o.tenantId) ?? 0) + netRevenue(o));
    }

    const rows: BrandRow[] = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      storeCount: (storeMap.get(t.id) as number) ?? 0,
      memberCount: (memberMap.get(t.id) as number) ?? 0,
      orderCount: orderCount.get(t.id) ?? 0,
      revenueCents: revenue.get(t.id) ?? 0,
      customDomain: domainMap.get(t.id)?.hostname ?? null,
      domainStatus: domainMap.get(t.id)?.status ?? null,
      theme: t.theme,
    }));

    return { rows, total };
  });
}

export type BrandKpis = {
  totalBrands: number;
  activeBrands: number;
  totalStores: number;
  totalMembers: number;
  totalOrders: number;
  totalRevenueCents: number;
};

export async function getBrandKpis(ctx: RequestContext): Promise<BrandKpis> {
  return withTenant(ctx, async (tx) => {
    const [totalBrands, activeBrands, totalStores, totalMembers, totalOrders, revenue] = await Promise.all([
      tx.tenant.count(),
      tx.tenant.count({ where: { status: "active" } }),
      tx.location.count(),
      tx.membership.count(),
      tx.order.count(),
      tx.order.aggregate({ _sum: { subtotalCents: true, refundedCents: true }, where: { status: { in: PAID } } }),
    ]);
    const totalRevenueCents = (revenue._sum.subtotalCents ?? 0) - (revenue._sum.refundedCents ?? 0);
    return { totalBrands, activeBrands, totalStores, totalMembers, totalOrders, totalRevenueCents };
  });
}

export type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  theme: Record<string, unknown>;
  tagline: string | null;
  hqAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /**
   * Stores with their manager and member count. Manager is derived from
   * Membership rather than stored on Location: a store's manager IS a member
   * assigned to it, so duplicating the name would let the two disagree.
   */
  stores: Array<{
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    status: string;
    managerName: string | null;
    managerEmail: string | null;
    memberCount: number;
  }>;
  /** Recent privileged actions for this brand, newest first. */
  activity: Array<{
    id: string;
    action: string;
    entity: string;
    actorId: string;
    createdAt: Date;
  }>;
  members: Array<{ id: string; displayName: string | null; email: string | null; role: string }>;
  orderCount: number;
  revenueCents: number;
  productCount: number;
  domains: Array<{ id: string; hostname: string; status: string }>;
};

/** Fetch one brand by its clean slug (URL-friendly). KICK_ADMIN only. */
export async function getBrandBySlug(ctx: RequestContext, slug: string): Promise<BrandDetail> {
  return withTenant(ctx, async (tx) => {
    const t = await tx.tenant.findUnique({
      where: { slug },
      include: {
        locations: { orderBy: { name: "asc" } },
        memberships: true,
        customDomains: true,
        _count: { select: { products: true } },
      },
    });
    if (!t) throw new HttpError(404, "Brand not found");

    const [orders, activity] = await Promise.all([
      tx.order.findMany({ where: { tenantId: t.id }, select: { status: true, subtotalCents: true, refundedCents: true } }),
      // Recent privileged actions for THIS brand only. AuditLog is already
      // tenant-scoped by RLS; the explicit filter keeps intent obvious.
      tx.auditLog.findMany({
        where: { tenantId: t.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, entity: true, actorId: true, createdAt: true },
      }),
    ]);
    const revenueCents = orders.filter((o) => PAID.includes(o.status)).reduce((s, o) => s + netRevenue(o), 0);

    // Members per store, and the manager for each. The manager is whichever
    // member holds the store — derived, not stored, so a renamed member cannot
    // leave a stale manager name behind.
    const byLocation = new Map<string, typeof t.memberships>();
    for (const m of t.memberships) {
      if (!m.locationId) continue;
      const list = byLocation.get(m.locationId) ?? [];
      list.push(m);
      byLocation.set(m.locationId, list);
    }

    return {
      tagline: t.tagline,
      activity,
      hqAddress: t.hqAddress,
      phone: t.phone,
      email: t.email,
      website: t.website,
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      theme: (t.theme as Record<string, unknown>) ?? {},
      stores: t.locations.map((l) => {
        const staff = byLocation.get(l.id) ?? [];
        // A store's "manager" is its franchisor-level member if one is
        // assigned there, otherwise the first member — never a stored copy.
        const manager = staff.find((m) => m.role === "FRANCHISOR_ADMIN") ?? staff[0];
        return {
          id: l.id,
          name: l.name,
          address: l.address,
          phone: l.phone,
          status: l.status,
          managerName: manager?.displayName ?? null,
          managerEmail: manager?.email ?? null,
          memberCount: staff.length,
        };
      }),
      members: t.memberships.map((m) => ({ id: m.id, displayName: m.displayName, email: m.email, role: m.role })),
      orderCount: orders.length,
      revenueCents,
      productCount: t._count.products,
      domains: t.customDomains.map((d) => ({ id: d.id, hostname: d.hostname, status: d.status })),
    };
  });
}
