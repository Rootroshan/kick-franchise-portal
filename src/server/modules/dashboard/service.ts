import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";

/**
 * Cross-tenant super-admin dashboard aggregation. KICK_ADMIN only — RLS lets
 * that role read across every tenant, so all of these run inside one
 * withTenant(ctx) call. Every number is live from Postgres — no hardcoded
 * dashboard values anywhere.
 *
 * "This month" = the current calendar month; "previous period" = the month
 * before, used for the change % on each KPI. All money is integer cents.
 */

function monthRange(offsetMonths = 0, now = new Date()): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + offsetMonths;
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return { start, end };
}

function currentPeriodLabel(now = new Date()): string {
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

/** % change vs previous, guarding divide-by-zero. Positive = up. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "new" (no baseline)
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const PAID_STATUSES = ["PAID", "FULFILLED"] as const;

export type Kpi = {
  key: string;
  label: string;
  value: number; // raw (cents for money, count otherwise)
  isMoney: boolean;
  changePct: number | null; // vs previous month; null = no baseline
  sub?: string;
};

export type DashboardData = {
  periodLabel: string;
  kpis: Kpi[];
  brands: Array<{ id: string; name: string; slug: string; status: string; storeCount: number; salesCents: number; orderCount: number; allowanceUsedCents: number }>;
  totals: { activeStores: number; franchisors: number; users: number; kickAdmins: number };
  commerce: { productCount: number; activeVariantCount: number; pricingRuleCount: number; trackedStock: number; totalStock: number; pendingFulfilment: number; cardVolumeCents: number };
  allowanceRebate: {
    allowanceGrantedCents: number;
    allowanceUsedCents: number;
    allowanceRemainingCents: number;
    rebateAccruedCents: number;
  };
  sales: { monthlyRevenueCents: number; series: Array<{ label: string; cents: number }> };
  ordersByStatus: Array<{ status: string; count: number }>;
  recentOrders: Array<{ id: string; createdAt: Date; tenantName: string; storeName: string; status: string; subtotalCents: number; allowanceAppliedCents: number; cardChargedCents: number }>;
  activity: Array<{ id: string; action: string; entity: string; actorId: string; tenantName: string | null; createdAt: Date }>;
  alerts: Array<{ kind: string; label: string; count: number }>;
};

/** Badge counts for the shell (cheap; runs on every admin page). */
export async function getAdminBadgeCounts(): Promise<{ notifications: number }> {
  const [overdue, failed, unverified] = await withTenant(systemKickContext(), (tx) =>
    Promise.all([
      tx.taskAssignment.count({ where: { status: "OPEN", task: { dueAt: { lt: new Date() } } } }),
      tx.order.count({ where: { status: "FAILED" } }),
      tx.customDomain.count({ where: { status: { not: "VERIFIED" } } }),
    ])
  );
  return { notifications: overdue + failed + unverified };
}

export async function getDashboardData(ctx: RequestContext): Promise<DashboardData> {
  const period = currentPeriodLabel();
  const thisMonth = monthRange(0);
  const prevMonth = monthRange(-1);

  return withTenant(ctx, async (tx) => {
    const [
      tenants,
      activeStores,
      memberships,
      thisMonthOrders,
      prevMonthOrders,
      allPaidThisMonth,
      allPaidPrevMonth,
      productCount,
      activeVariantCount,
      pricingRuleCount,
      variantsForStock,
      pendingFulfilment,
      allowances,
      rebateThisMonth,
      rebatePrevMonth,
      recentOrdersRaw,
      ordersGrouped,
      auditRaw,
      lowAllowances,
      failedOrders,
      overdueTasks,
      unverifiedDomains,
    ] = await Promise.all([
      tx.tenant.findMany({ orderBy: { createdAt: "asc" } }),
      tx.location.count({ where: { status: "active" } }),
      tx.membership.findMany({ select: { role: true } }),
      tx.order.findMany({ where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: thisMonth.start, lt: thisMonth.end } }, select: { tenantId: true, subtotalCents: true, cardChargedCents: true } }),
      tx.order.findMany({ where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: prevMonth.start, lt: prevMonth.end } }, select: { subtotalCents: true } }),
      tx.order.count({ where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: thisMonth.start, lt: thisMonth.end } } }),
      tx.order.count({ where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: prevMonth.start, lt: prevMonth.end } } }),
      tx.product.count(),
      tx.productVariant.count({ where: { active: true } }),
      tx.locationOrderingRule.count(),
      tx.productVariant.findMany({ select: { stock: true } }),
      tx.order.count({ where: { status: { in: ["PAID", "PENDING"] } } }),
      tx.allowance.findMany({ where: { periodLabel: period }, include: { ledger: true } }),
      tx.rebateAccrual.aggregate({ _sum: { amountCents: true }, where: { accruedAt: { gte: thisMonth.start, lt: thisMonth.end } } }),
      tx.rebateAccrual.aggregate({ _sum: { amountCents: true }, where: { accruedAt: { gte: prevMonth.start, lt: prevMonth.end } } }),
      tx.order.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { tenant: true, location: true } }),
      tx.order.groupBy({ by: ["status"], _count: { _all: true } }),
      tx.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { tenant: true } }),
      tx.allowance.findMany({ where: { periodLabel: period }, include: { ledger: true } }),
      tx.order.count({ where: { status: "FAILED" } }),
      tx.taskAssignment.count({ where: { status: "OPEN", task: { dueAt: { lt: new Date() } } } }),
      tx.customDomain.count({ where: { status: { not: "VERIFIED" } } }),
    ]);

    // ---- money rollups ----
    const salesThisMonth = thisMonthOrders.reduce((s, o) => s + o.subtotalCents, 0);
    const salesPrevMonth = prevMonthOrders.reduce((s, o) => s + o.subtotalCents, 0);
    const cardVolume = thisMonthOrders.reduce((s, o) => s + o.cardChargedCents, 0);

    const grantOf = (a: { grantedCents: number; ledger: { deltaCents: number; reason: string }[] }) =>
      a.grantedCents + a.ledger.filter((l) => l.reason === "GRANT").reduce((s, l) => s + l.deltaCents, 0);
    const usedOf = (a: { ledger: { deltaCents: number; reason: string }[] }) =>
      a.ledger.filter((l) => l.reason === "ORDER_DEBIT").reduce((s, l) => s + Math.abs(l.deltaCents), 0);
    const balanceOf = (a: { grantedCents: number; ledger: { deltaCents: number }[] }) =>
      a.grantedCents + a.ledger.reduce((s, l) => s + l.deltaCents, 0);

    const allowanceGranted = allowances.reduce((s, a) => s + grantOf(a), 0);
    const allowanceUsed = allowances.reduce((s, a) => s + usedOf(a), 0);
    const rebateAccrued = rebateThisMonth._sum.amountCents ?? 0;
    const rebatePrev = rebatePrevMonth._sum.amountCents ?? 0;

    // ---- per-brand ----
    const salesByTenant = new Map<string, number>();
    const ordersByTenant = new Map<string, number>();
    for (const o of thisMonthOrders) {
      salesByTenant.set(o.tenantId, (salesByTenant.get(o.tenantId) ?? 0) + o.subtotalCents);
      ordersByTenant.set(o.tenantId, (ordersByTenant.get(o.tenantId) ?? 0) + 1);
    }
    const usedByTenant = new Map<string, number>();
    for (const a of allowances) usedByTenant.set(a.tenantId, (usedByTenant.get(a.tenantId) ?? 0) + usedOf(a));
    const storeCounts = new Map<string, number>();
    for (const t of tenants) storeCounts.set(t.id, await tx.location.count({ where: { tenantId: t.id } }));

    const brands = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      storeCount: storeCounts.get(t.id) ?? 0,
      salesCents: salesByTenant.get(t.id) ?? 0,
      orderCount: ordersByTenant.get(t.id) ?? 0,
      allowanceUsedCents: usedByTenant.get(t.id) ?? 0,
    }));

    // ---- sales series: last 6 months of revenue ----
    const series: Array<{ label: string; cents: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const r = monthRange(-i);
      const monthOrders = await tx.order.aggregate({
        _sum: { subtotalCents: true },
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: r.start, lt: r.end } },
      });
      series.push({ label: r.start.toLocaleString("en-CA", { month: "short", timeZone: "UTC" }), cents: monthOrders._sum.subtotalCents ?? 0 });
    }

    // ---- alerts ----
    const lowCount = lowAllowances.filter((a) => balanceOf(a) < 5000).length;
    const alerts: DashboardData["alerts"] = [];
    if (lowCount > 0) alerts.push({ kind: "allowance_low", label: "stores with allowance under $50", count: lowCount });
    if (failedOrders > 0) alerts.push({ kind: "payment_failed", label: "orders with a failed payment", count: failedOrders });
    if (overdueTasks > 0) alerts.push({ kind: "task_overdue", label: "overdue task assignments", count: overdueTasks });
    if (unverifiedDomains > 0) alerts.push({ kind: "domain_unverified", label: "custom domains awaiting verification", count: unverifiedDomains });

    const trackedStock = variantsForStock.filter((v) => v.stock !== null).reduce((s, v) => s + (v.stock ?? 0), 0);

    const roleCount = (r: string) => memberships.filter((m) => m.role === r).length;

    return {
      periodLabel: period,
      kpis: [
        { key: "brands", label: "Total Brands", value: tenants.length, isMoney: false, changePct: null, sub: "on the platform" },
        { key: "stores", label: "Active Stores", value: activeStores, isMoney: false, changePct: null, sub: "franchisee locations" },
        { key: "orders", label: "Monthly Orders", value: thisMonthOrders.length, isMoney: false, changePct: pctChange(allPaidThisMonth, allPaidPrevMonth), sub: "paid this month" },
        { key: "allowance", label: "Allowance Used", value: allowanceUsed, isMoney: true, changePct: null, sub: allowanceGranted > 0 ? `${Math.round((allowanceUsed / allowanceGranted) * 100)}% of granted` : "no grants yet" },
        { key: "rebate", label: "Rebate Value", value: rebateAccrued, isMoney: true, changePct: pctChange(rebateAccrued, rebatePrev), sub: "accrued this month" },
        { key: "revenue", label: "Revenue This Month", value: salesThisMonth, isMoney: true, changePct: pctChange(salesThisMonth, salesPrevMonth), sub: "paid + fulfilled orders" },
      ],
      brands,
      totals: {
        activeStores,
        franchisors: roleCount("FRANCHISOR_ADMIN"),
        users: memberships.length,
        kickAdmins: roleCount("KICK_ADMIN"),
      },
      commerce: {
        productCount,
        activeVariantCount,
        pricingRuleCount,
        trackedStock,
        totalStock: trackedStock,
        pendingFulfilment,
        cardVolumeCents: cardVolume,
      },
      allowanceRebate: {
        allowanceGrantedCents: allowanceGranted,
        allowanceUsedCents: allowanceUsed,
        allowanceRemainingCents: allowanceGranted - allowanceUsed,
        rebateAccruedCents: rebateAccrued,
      },
      sales: { monthlyRevenueCents: salesThisMonth, series },
      ordersByStatus: ordersGrouped.map((g) => ({ status: g.status, count: g._count._all })),
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        tenantName: o.tenant.name,
        storeName: o.location.name,
        status: o.status,
        subtotalCents: o.subtotalCents,
        allowanceAppliedCents: o.allowanceAppliedCents,
        cardChargedCents: o.cardChargedCents,
      })),
      activity: auditRaw.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        actorId: a.actorId,
        tenantName: a.tenant?.name ?? null,
        createdAt: a.createdAt,
      })),
      alerts,
    };
  });
}
