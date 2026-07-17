import { withTenant, type RequestContext } from "@/server/db/withTenant";
import type { AdminListQuery } from "@/lib/adminQuery";

export type ReportRow = {
  id: string;
  brandName: string;
  brandSlug: string;
  period: string;
  periodLabel: string;
  salesTotalCents: number;
  rebateTotalCents: number;
  hasCsv: boolean;
  hasPdf: boolean;
  generatedAt: Date;
};

export type ReportListResult = { rows: ReportRow[]; total: number };

/** Cross-tenant rebate reports with search/brand/period-type/pagination. KICK_ADMIN only. */
export async function listReportsAdmin(ctx: RequestContext, q: AdminListQuery): Promise<ReportListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { periodLabel: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
      ...(q.raw.period === "MONTHLY" || q.raw.period === "QUARTERLY" ? { period: q.raw.period as "MONTHLY" | "QUARTERLY" } : {}),
    };

    const [items, total] = await Promise.all([
      tx.rebateReport.findMany({
        where,
        orderBy: { generatedAt: q.direction },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { tenant: { select: { name: true, slug: true } } },
      }),
      tx.rebateReport.count({ where }),
    ]);

    const rows: ReportRow[] = items.map((r) => ({
      id: r.id,
      brandName: r.tenant.name,
      brandSlug: r.tenant.slug,
      period: r.period,
      periodLabel: r.periodLabel,
      salesTotalCents: r.salesTotalCents,
      rebateTotalCents: r.rebateTotalCents,
      hasCsv: Boolean(r.csvStorageKey),
      hasPdf: Boolean(r.pdfStorageKey),
      generatedAt: r.generatedAt,
    }));

    return { rows, total };
  });
}

export type ReportKpis = { total: number; salesTotalCents: number; rebateTotalCents: number };

export async function getReportKpis(ctx: RequestContext): Promise<ReportKpis> {
  return withTenant(ctx, async (tx) => {
    const [total, agg] = await Promise.all([
      tx.rebateReport.count(),
      tx.rebateReport.aggregate({ _sum: { salesTotalCents: true, rebateTotalCents: true } }),
    ]);
    return { total, salesTotalCents: agg._sum.salesTotalCents ?? 0, rebateTotalCents: agg._sum.rebateTotalCents ?? 0 };
  });
}
