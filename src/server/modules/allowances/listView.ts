import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

/** Balance from an allowance's grant + ledger deltas (append-only ledger). */
function balanceOf(grantedCents: number, ledger: Array<{ deltaCents: number }>): number {
  return ledger.reduce((s, l) => s + l.deltaCents, grantedCents);
}
function usedOf(ledger: Array<{ deltaCents: number; reason: string }>): number {
  return ledger.filter((l) => l.reason === "ORDER_DEBIT").reduce((s, l) => s + Math.abs(l.deltaCents), 0);
}

export type AllowanceRow = {
  id: string;
  periodLabel: string;
  brandName: string;
  brandSlug: string;
  storeName: string;
  grantedCents: number;
  usedCents: number;
  balanceCents: number;
  currency: string;
};

export type AllowanceListResult = { rows: AllowanceRow[]; total: number };

/** Cross-tenant allowance list with search/brand/period/pagination + computed balances. KICK_ADMIN only. */
export async function listAllowancesAdmin(ctx: RequestContext, q: AdminListQuery): Promise<AllowanceListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { OR: [{ periodLabel: { contains: q.search, mode: "insensitive" as const } }, { location: { name: { contains: q.search, mode: "insensitive" as const } } }] } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
      ...(q.raw.period ? { periodLabel: q.raw.period } : {}),
    };

    const orderBy = q.sort === "period" ? { periodLabel: q.direction } : { createdAt: q.direction };

    const [items, total] = await Promise.all([
      tx.allowance.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } }, location: { select: { name: true } }, ledger: { select: { deltaCents: true, reason: true } } },
      }),
      tx.allowance.count({ where }),
    ]);

    const rows: AllowanceRow[] = items.map((a) => ({
      id: a.id,
      periodLabel: a.periodLabel,
      brandName: a.tenant.name,
      brandSlug: a.tenant.slug,
      storeName: a.location.name,
      grantedCents: a.grantedCents,
      usedCents: usedOf(a.ledger),
      balanceCents: balanceOf(a.grantedCents, a.ledger),
      currency: a.currency,
    }));

    return { rows, total };
  });
}

export type AllowanceKpis = { grantedCents: number; usedCents: number; balanceCents: number; count: number };

export async function getAllowanceKpis(ctx: RequestContext): Promise<AllowanceKpis> {
  return withTenant(ctx, async (tx) => {
    const items = await tx.allowance.findMany({ select: { grantedCents: true, ledger: { select: { deltaCents: true, reason: true } } } });
    let grantedCents = 0,
      usedCents = 0,
      balanceCents = 0;
    for (const a of items) {
      grantedCents += a.grantedCents;
      usedCents += usedOf(a.ledger);
      balanceCents += balanceOf(a.grantedCents, a.ledger);
    }
    return { grantedCents, usedCents, balanceCents, count: items.length };
  });
}

export type AllowanceDetail = {
  id: string;
  periodLabel: string;
  brandName: string;
  brandSlug: string;
  storeName: string;
  grantedCents: number;
  usedCents: number;
  balanceCents: number;
  currency: string;
  ledger: Array<{ id: string; deltaCents: number; balanceAfter: number; reason: string; orderId: string | null; createdAt: Date }>;
};

/** One allowance with its full append-only ledger. KICK_ADMIN only. */
export async function getAllowanceDetail(ctx: RequestContext, id: string): Promise<AllowanceDetail> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.allowance.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, slug: true } },
        location: { select: { name: true } },
        ledger: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!a) throw new HttpError(404, "Allowance not found");

    return {
      id: a.id,
      periodLabel: a.periodLabel,
      brandName: a.tenant.name,
      brandSlug: a.tenant.slug,
      storeName: a.location.name,
      grantedCents: a.grantedCents,
      usedCents: usedOf(a.ledger),
      balanceCents: balanceOf(a.grantedCents, a.ledger),
      currency: a.currency,
      ledger: a.ledger.map((l) => ({ id: l.id, deltaCents: l.deltaCents, balanceAfter: l.balanceAfter, reason: l.reason, orderId: l.orderId, createdAt: l.createdAt })),
    };
  });
}
