import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";

/** Tenant-scoped onboarding templates with completion rollups. No commerce. */
export type TemplateRow = {
  id: string;
  name: string;
  itemCount: number;
  storesAssigned: number;
  storesCompleted: number;
  percent: number;
  updatedAt: Date;
};

function pct(n: number, d: number): number {
  return d <= 0 ? 0 : Math.round((n / d) * 100);
}

export async function listTemplates(ctx: RequestContext, tenantId: string): Promise<TemplateRow[]> {
  return withTenant(ctx, async (tx) => {
    const templates = await tx.onboardingTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } }, items: { select: { progress: { select: { locationId: true, done: true } } } } },
    });

    return templates.map((t) => {
      const perStore = new Map<string, { total: number; done: number }>();
      for (const it of t.items) {
        for (const p of it.progress) {
          const cur = perStore.get(p.locationId) ?? { total: 0, done: 0 };
          cur.total += 1;
          if (p.done) cur.done += 1;
          perStore.set(p.locationId, cur);
        }
      }
      const storesAssigned = perStore.size;
      const storesCompleted = [...perStore.values()].filter((v) => v.total > 0 && v.done === v.total).length;
      return { id: t.id, name: t.name, itemCount: t._count.items, storesAssigned, storesCompleted, percent: pct(storesCompleted, storesAssigned), updatedAt: t.updatedAt };
    });
  });
}

export type TemplateDetail = {
  id: string;
  name: string;
  steps: Array<{ id: string; title: string; order: number; storesCompleted: number; percent: number }>;
  storesAssigned: number;
  storesCompleted: number;
  percent: number;
};

export async function getTemplateDetail(ctx: RequestContext, tenantId: string, id: string): Promise<TemplateDetail> {
  return withTenant(ctx, async (tx) => {
    const t = await tx.onboardingTemplate.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: { order: "asc" }, include: { progress: { select: { locationId: true, done: true } } } } },
    });
    if (!t) throw new HttpError(404, "Template not found");

    const storeIds = new Set<string>();
    const perStore = new Map<string, { total: number; done: number }>();
    const steps = t.items.map((it) => {
      let done = 0;
      for (const p of it.progress) {
        storeIds.add(p.locationId);
        const cur = perStore.get(p.locationId) ?? { total: 0, done: 0 };
        cur.total += 1;
        if (p.done) {
          cur.done += 1;
          done += 1;
        }
        perStore.set(p.locationId, cur);
      }
      return { id: it.id, title: it.title, order: it.order, storesCompleted: done, percent: pct(done, it.progress.length) };
    });

    const storesAssigned = storeIds.size;
    const storesCompleted = [...perStore.values()].filter((v) => v.total > 0 && v.done === v.total).length;
    return { id: t.id, name: t.name, steps, storesAssigned, storesCompleted, percent: pct(storesCompleted, storesAssigned) };
  });
}

export type StoreProgressRow = {
  locationId: string;
  storeName: string;
  currentStep: string;
  done: number;
  total: number;
  percent: number;
  lastActivity: Date | null;
  status: "not_started" | "in_progress" | "completed";
};

/** Per-store progress across all templates (Store Progress tab). */
export async function storeProgress(ctx: RequestContext, tenantId: string): Promise<StoreProgressRow[]> {
  return withTenant(ctx, async (tx) => {
    const [locations, progress] = await Promise.all([
      tx.location.findMany({ where: { tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      tx.onboardingProgress.findMany({
        where: { item: { template: { tenantId } } },
        select: { locationId: true, done: true, doneAt: true, item: { select: { title: true, order: true } } },
      }),
    ]);

    return locations.map((l) => {
      const rows = progress.filter((p) => p.locationId === l.id);
      const total = rows.length;
      const done = rows.filter((p) => p.done).length;
      const lastActivity = rows.reduce<Date | null>((max, p) => (p.doneAt && (!max || p.doneAt > max) ? p.doneAt : max), null);
      const nextStep = rows.filter((p) => !p.done).sort((a, b) => a.item.order - b.item.order)[0];
      const status: StoreProgressRow["status"] = total === 0 ? "not_started" : done === total ? "completed" : "in_progress";
      return {
        locationId: l.id,
        storeName: l.name,
        currentStep: status === "completed" ? "Complete" : nextStep?.item.title ?? "Not started",
        done,
        total,
        percent: pct(done, total),
        lastActivity,
        status,
      };
    });
  });
}
