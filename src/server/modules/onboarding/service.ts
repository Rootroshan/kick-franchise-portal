import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createOnboardingTemplateSchema, markProgressSchema } from "./schemas";

/** [K,F]: create a reusable onboarding template with ordered checklist items. */
export async function createOnboardingTemplate(ctx: RequestContext, tenantId: string, input: z.infer<typeof createOnboardingTemplateSchema>) {
  return withTenant(ctx, async (tx) => {
    const template = await tx.onboardingTemplate.create({
      data: {
        tenantId,
        name: input.name,
        items: {
          create: input.items.map((item, index) => ({ title: item.title, order: index })),
        },
      },
      include: { items: true },
    });

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "onboardingTemplate.create",
      entity: "OnboardingTemplate",
      entityId: template.id,
      after: { name: template.name, itemCount: template.items.length },
    });

    return template;
  });
}

export async function listOnboardingTemplates(ctx: RequestContext, tenantId: string | null) {
  return withTenant(ctx, (tx) =>
    tx.onboardingTemplate.findMany({
      where: { tenantId: tenantId ?? undefined },
      include: { items: { orderBy: { order: "asc" } } },
    })
  );
}

/**
 * [U]: mark one checklist item done/undone for the caller's own location.
 * A new location always starts at 0% — there is no seeding of progress rows;
 * "done" defaults false via the absence of an OnboardingProgress row.
 */
export async function markOnboardingProgress(ctx: RequestContext, templateId: string, input: z.infer<typeof markProgressSchema>) {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Only franchisee users update their own onboarding progress");
  }
  return withTenant(ctx, async (tx) => {
    const item = await tx.onboardingItem.findUnique({ where: { id: input.itemId } });
    if (!item || item.templateId !== templateId) {
      throw new HttpError(404, "Onboarding item not found for this template");
    }

    return tx.onboardingProgress.upsert({
      where: { locationId_itemId: { locationId: ctx.locationId!, itemId: input.itemId } },
      create: {
        locationId: ctx.locationId!,
        templateId,
        itemId: input.itemId,
        done: input.done,
        doneAt: input.done ? new Date() : null,
        doneBy: input.done ? ctx.userId : null,
      },
      update: {
        done: input.done,
        doneAt: input.done ? new Date() : null,
        doneBy: input.done ? ctx.userId : null,
      },
    });
  });
}

/** [U]: percent complete for the caller's own location against a template. */
export async function getOwnOnboardingProgress(ctx: RequestContext, templateId: string) {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Forbidden");
  }
  return withTenant(ctx, async (tx) => {
    const items = await tx.onboardingItem.findMany({ where: { templateId }, orderBy: { order: "asc" } });
    const progress = await tx.onboardingProgress.findMany({ where: { locationId: ctx.locationId!, templateId } });
    const doneMap = new Map(progress.map((p) => [p.itemId, p]));

    const checklist = items.map((item) => ({
      itemId: item.id,
      title: item.title,
      order: item.order,
      done: doneMap.get(item.id)?.done ?? false,
      doneAt: doneMap.get(item.id)?.doneAt ?? null,
    }));
    const doneCount = checklist.filter((c) => c.done).length;

    return {
      templateId,
      checklist,
      percentComplete: items.length ? Math.round((doneCount / items.length) * 100) : 0,
    };
  });
}

/** [K,F]: visibility into every location's progress against a template, to spot stuck locations. */
export async function getTemplateProgressOverview(ctx: RequestContext, templateId: string) {
  return withTenant(ctx, async (tx) => {
    const template = await tx.onboardingTemplate.findUnique({ where: { id: templateId }, include: { items: true } });
    if (!template) throw new HttpError(404, "Template not found");

    const locations = await tx.location.findMany({ where: { tenantId: template.tenantId } });
    const allProgress = await tx.onboardingProgress.findMany({ where: { templateId } });

    const totalItems = template.items.length;
    return locations.map((loc) => {
      const doneCount = allProgress.filter((p) => p.locationId === loc.id && p.done).length;
      return {
        locationId: loc.id,
        locationName: loc.name,
        percentComplete: totalItems ? Math.round((doneCount / totalItems) * 100) : 0,
        isStuck: totalItems > 0 && doneCount === 0,
      };
    });
  });
}
