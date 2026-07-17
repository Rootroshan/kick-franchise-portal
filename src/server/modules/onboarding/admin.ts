import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import type { AdminListQuery } from "@/lib/adminQuery";

export type OnboardingRow = {
  id: string;
  name: string;
  brandName: string;
  brandSlug: string;
  itemCount: number;
  storeCount: number;
  completedItems: number;
  totalCheckpoints: number;
  createdAt: Date;
};

export type OnboardingListResult = { rows: OnboardingRow[]; total: number };

/** Cross-tenant onboarding templates with roll-up completion. KICK_ADMIN only.
 *  Completion = done progress rows / (items × stores in the template's brand). */
export async function listOnboardingAdmin(ctx: RequestContext, q: AdminListQuery): Promise<OnboardingListResult> {
  return withTenant(ctx, async (tx) => {
    const where = {
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...(q.brand ? { tenant: { slug: q.brand } } : {}),
    };

    const [templates, total] = await Promise.all([
      tx.onboardingTemplate.findMany({
        where,
        orderBy: q.sort === "name" ? { name: q.direction } : { createdAt: q.direction },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          tenant: { select: { name: true, slug: true, _count: { select: { locations: true } } } },
          _count: { select: { items: true } },
          items: { select: { progress: { select: { done: true } } } },
        },
      }),
      tx.onboardingTemplate.count({ where }),
    ]);

    const rows: OnboardingRow[] = templates.map((t) => {
      const itemCount = t._count.items;
      const storeCount = t.tenant._count.locations;
      const completedItems = t.items.reduce((s, it) => s + it.progress.filter((p) => p.done).length, 0);
      const totalCheckpoints = itemCount * storeCount;
      return {
        id: t.id,
        name: t.name,
        brandName: t.tenant.name,
        brandSlug: t.tenant.slug,
        itemCount,
        storeCount,
        completedItems,
        totalCheckpoints,
        createdAt: t.createdAt,
      };
    });

    return { rows, total };
  });
}

export type OnboardingKpis = { templates: number; items: number; avgCompletionPct: number };

export async function getOnboardingKpis(ctx: RequestContext): Promise<OnboardingKpis> {
  return withTenant(ctx, async (tx) => {
    const [templates, items, progressRows] = await Promise.all([
      tx.onboardingTemplate.count(),
      tx.onboardingItem.count(),
      tx.onboardingProgress.findMany({ select: { done: true } }),
    ]);
    const done = progressRows.filter((p) => p.done).length;
    const avgCompletionPct = progressRows.length === 0 ? 0 : Math.round((done / progressRows.length) * 100);
    return { templates, items, avgCompletionPct };
  });
}

export type OnboardingDetail = {
  id: string;
  name: string;
  brandName: string;
  brandSlug: string;
  items: Array<{ id: string; title: string; order: number; doneCount: number }>;
  stores: Array<{ locationId: string; storeName: string; done: number; total: number }>;
};

/** Per-template breakdown: items and per-store progress. KICK_ADMIN only. */
export async function getOnboardingDetail(ctx: RequestContext, templateId: string): Promise<OnboardingDetail> {
  return withTenant(ctx, async (tx) => {
    const t = await tx.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: {
        tenant: { select: { name: true, slug: true, locations: { select: { id: true, name: true }, orderBy: { name: "asc" } } } },
        items: { orderBy: { order: "asc" }, include: { progress: { select: { locationId: true, done: true } } } },
      },
    });
    if (!t) throw new HttpError(404, "Onboarding template not found");

    const items = t.items.map((it) => ({
      id: it.id,
      title: it.title,
      order: it.order,
      doneCount: it.progress.filter((p) => p.done).length,
    }));

    const itemCount = t.items.length;
    const stores = t.tenant.locations.map((loc) => {
      const done = t.items.reduce((s, it) => s + it.progress.filter((p) => p.locationId === loc.id && p.done).length, 0);
      return { locationId: loc.id, storeName: loc.name, done, total: itemCount };
    });

    return { id: t.id, name: t.name, brandName: t.tenant.name, brandSlug: t.tenant.slug, items, stores };
  });
}
