"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { createOnboardingTemplate } from "@/server/modules/onboarding/service";
import { HttpError } from "@/server/modules/identity/errors";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  steps: z.array(z.string().min(1)).min(1, "Add at least one step"),
});

function parse(formData: FormData) {
  return templateSchema.parse({
    name: formData.get("name"),
    steps: formData.getAll("steps").map(String).map((s) => s.trim()).filter(Boolean),
  });
}

export async function createTemplateAction(formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = parse(formData);
  const tpl = await createOnboardingTemplate(ctx, ctx.tenantId, { name: input.name, items: input.steps.map((title) => ({ title })) });
  revalidatePath("/franchisor/onboarding");
  redirect(`/franchisor/onboarding/${tpl.id}`);
}

/** Replace the template's name + steps. Existing progress for removed steps is
 *  cascade-deleted (OnboardingProgress FK onDelete: Cascade on item). */
export async function updateTemplateAction(id: string, formData: FormData) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const input = parse(formData);
  await withTenant(ctx, async (tx) => {
    const tpl = await tx.onboardingTemplate.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { items: true } });
    if (!tpl) throw new HttpError(404, "Template not found");
    await tx.onboardingTemplate.update({ where: { id }, data: { name: input.name } });
    // Reconcile steps: delete removed, upsert by order.
    await tx.onboardingItem.deleteMany({ where: { templateId: id } });
    await tx.onboardingItem.createMany({ data: input.steps.map((title, order) => ({ templateId: id, title, order })) });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "onboardingTemplate.update", entity: "OnboardingTemplate", entityId: id, after: { name: input.name, steps: input.steps.length } });
  });
  revalidatePath("/franchisor/onboarding");
  revalidatePath(`/franchisor/onboarding/${id}`);
  redirect(`/franchisor/onboarding/${id}`);
}

export async function duplicateTemplateAction(id: string) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const newId = await withTenant(ctx, async (tx) => {
    const src = await tx.onboardingTemplate.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { items: { orderBy: { order: "asc" } } } });
    if (!src) throw new HttpError(404, "Template not found");
    const copy = await tx.onboardingTemplate.create({
      data: { tenantId: ctx.tenantId, name: `${src.name} (copy)`, items: { create: src.items.map((it) => ({ title: it.title, order: it.order })) } },
    });
    await writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "onboardingTemplate.duplicate", entity: "OnboardingTemplate", entityId: copy.id, after: { from: id } });
    return copy.id;
  });
  revalidatePath("/franchisor/onboarding");
  redirect(`/franchisor/onboarding/${newId}/edit`);
}
