import { withTenant, type RequestContext } from "@/server/db/withTenant";

/**
 * Cross-tenant super-admin dashboard aggregation. KICK_ADMIN only — RLS lets
 * that role read across every tenant, so all of these run inside one
 * withTenant(ctx) call. Every number here is what Kick actually cares about:
 * sales, rebates it owes/bills, allowance burn, and what needs attention.
 */

function currentPeriodLabel(now = new Date()): string {
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

export type DashboardData = {
  periodLabel: string;
  kpis: {
    salesCents: number; // sum of PAID/FULFILLED order subtotals this period
    rebateCents: number; // sum of rebate accruals this period
    allowanceGrantedCents: number; // total granted this period
    allowanceUsedCents: number; // debited this period
    tenantCount: number;
    storeCount: number;
    orderCount: number;
  };
  brands: Array<{
    id: string;
    name: string;
    slug: string;
    storeCount: number;
    salesCents: number;
    orderCount: number;
  }>;
  recentOrders: Array<{
    id: string;
    createdAt: Date;
    tenantName: string;
    storeName: string;
    status: string;
    subtotalCents: number;
    allowanceAppliedCents: number;
    cardChargedCents: number;
  }>;
  alerts: Array<{ kind: "allowance_low" | "payment_failed" | "task_overdue" | "domain_unverified"; label: string; count: number }>;
};

export async function getDashboardData(ctx: RequestContext): Promise<DashboardData> {
  const period = currentPeriodLabel();
  const periodStart = periodStartDate();

  return withTenant(ctx, async (tx) => {
    const [tenants, stores, paidOrders, recentOrdersRaw, accruals, allowances, lowAllowances, failedOrders, overdueTasks, unverifiedDomains] =
      await Promise.all([
        tx.tenant.findMany({ orderBy: { createdAt: "asc" } }),
        tx.location.count(),
        tx.order.findMany({
          where: { status: { in: ["PAID", "FULFILLED"] }, createdAt: { gte: periodStart } },
          select: { tenantId: true, subtotalCents: true },
        }),
        tx.order.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { tenant: true, location: true },
        }),
        tx.rebateAccrual.findMany({ where: { accruedAt: { gte: periodStart } }, select: { amountCents: true } }),
        tx.allowance.findMany({ where: { periodLabel: period }, include: { ledger: true } }),
        // Alerts:
        tx.allowance.findMany({ where: { periodLabel: period }, include: { ledger: true, location: true } }),
        tx.order.count({ where: { status: "FAILED" } }),
        tx.taskAssignment.count({ where: { status: "OPEN", task: { dueAt: { lt: new Date() } } } }),
        tx.customDomain.count({ where: { status: { not: "VERIFIED" } } }),
      ]);

    // --- KPIs ---
    const salesCents = paidOrders.reduce((s, o) => s + o.subtotalCents, 0);
    const rebateCents = accruals.reduce((s, a) => s + a.amountCents, 0);

    const balanceOf = (ledger: { deltaCents: number }[], grantedCents: number) =>
      grantedCents + ledger.reduce((s, l) => s + l.deltaCents, 0);
    const allowanceGrantedCents = allowances.reduce(
      (s, a) => s + a.grantedCents + a.ledger.filter((l) => l.reason === "GRANT").reduce((x, l) => x + l.deltaCents, 0),
      0
    );
    const allowanceUsedCents = allowances.reduce(
      (s, a) => s + a.ledger.filter((l) => l.reason === "ORDER_DEBIT").reduce((x, l) => x + Math.abs(l.deltaCents), 0),
      0
    );

    // --- Per-brand rollup ---
    const salesByTenant = new Map<string, number>();
    const ordersByTenant = new Map<string, number>();
    for (const o of paidOrders) {
      salesByTenant.set(o.tenantId, (salesByTenant.get(o.tenantId) ?? 0) + o.subtotalCents);
      ordersByTenant.set(o.tenantId, (ordersByTenant.get(o.tenantId) ?? 0) + 1);
    }
    const storesByTenant = new Map<string, number>();
    for (const t of tenants) {
      storesByTenant.set(t.id, await tx.location.count({ where: { tenantId: t.id } }));
    }
    const brands = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      storeCount: storesByTenant.get(t.id) ?? 0,
      salesCents: salesByTenant.get(t.id) ?? 0,
      orderCount: ordersByTenant.get(t.id) ?? 0,
    }));

    // --- Recent orders ---
    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      tenantName: o.tenant.name,
      storeName: o.location.name,
      status: o.status,
      subtotalCents: o.subtotalCents,
      allowanceAppliedCents: o.allowanceAppliedCents,
      cardChargedCents: o.cardChargedCents,
    }));

    // --- Alerts ---
    const lowCount = lowAllowances.filter((a) => balanceOf(a.ledger, a.grantedCents) < 5000).length;
    const alerts: DashboardData["alerts"] = [];
    if (lowCount > 0) alerts.push({ kind: "allowance_low", label: "stores with allowance under $50", count: lowCount });
    if (failedOrders > 0) alerts.push({ kind: "payment_failed", label: "orders with a failed payment", count: failedOrders });
    if (overdueTasks > 0) alerts.push({ kind: "task_overdue", label: "overdue task assignments", count: overdueTasks });
    if (unverifiedDomains > 0) alerts.push({ kind: "domain_unverified", label: "custom domains awaiting verification", count: unverifiedDomains });

    return {
      periodLabel: period,
      kpis: {
        salesCents,
        rebateCents,
        allowanceGrantedCents,
        allowanceUsedCents,
        tenantCount: tenants.length,
        storeCount: stores,
        orderCount: paidOrders.length,
      },
      brands,
      recentOrders,
      alerts,
    };
  });
}

function periodStartDate(now = new Date()): Date {
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
}
