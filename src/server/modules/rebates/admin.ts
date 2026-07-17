import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type RebateRuleRow = {
  id: string;
  productName: string;
  brandName: string;
  brandSlug: string;
  type: string;
  value: number; // FLAT=cents, PERCENT=basis points
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  accruedCents: number;
  accrualCount: number;
};

export type RebateListResult = { rows: RebateRuleRow[]; total: number };

/** Formats a rebate rule's value for display. */
export function formatRebateValue(type: string, value: number): string {
  return type === "PERCENT" ? `${(value / 100).toFixed(2)}%` : `$${(value / 100).toFixed(2)} flat`;
}

/** Cross-tenant rebate rules with accrual totals. KICK_ADMIN only. */
export async function listRebateRulesAdmin(ctx: RequestContext, q: AdminListQuery): Promise<RebateListResult> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const where = {
      ...(q.search ? { product: { name: { contains: q.search, mode: "insensitive" as const } } } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
      ...(q.raw.type === "FLAT" || q.raw.type === "PERCENT" ? { type: q.raw.type as "FLAT" | "PERCENT" } : {}),
    };

    const orderBy = q.sort === "value" ? { value: q.direction } : { effectiveFrom: q.direction };

    const [rules, total] = await Promise.all([
      tx.rebateRule.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } }, product: { select: { name: true } }, accruals: { select: { amountCents: true } } },
      }),
      tx.rebateRule.count({ where }),
    ]);

    const rows: RebateRuleRow[] = rules.map((r) => ({
      id: r.id,
      productName: r.product.name,
      brandName: r.tenant.name,
      brandSlug: r.tenant.slug,
      type: r.type,
      value: r.value,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      isActive: r.effectiveFrom <= now && (!r.effectiveTo || r.effectiveTo >= now),
      accruedCents: r.accruals.reduce((s, a) => s + a.amountCents, 0),
      accrualCount: r.accruals.length,
    }));

    return { rows, total };
  });
}

export type RebateKpis = { rules: number; activeRules: number; accruedCents: number; reports: number };

export async function getRebateKpis(ctx: RequestContext): Promise<RebateKpis> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [rules, activeRules, accrual, reports] = await Promise.all([
      tx.rebateRule.count(),
      tx.rebateRule.count({ where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] } }),
      tx.rebateAccrual.aggregate({ _sum: { amountCents: true } }),
      tx.rebateReport.count(),
    ]);
    return { rules, activeRules, accruedCents: accrual._sum.amountCents ?? 0, reports };
  });
}
