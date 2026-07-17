import { z } from "zod";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";

/**
 * Franchisor settings — PERMITTED fields only. Never touches commerce,
 * pricing, Stripe, allowances, rebates, domains, or platform config (§16).
 * Brand edits are limited to the public display name + contact info stored in
 * Tenant.theme; the tenant slug/status/commerce settings are Kick-controlled.
 */

export type FranchisorSettings = {
  profile: { displayName: string; email: string | null; role: string; brandName: string };
  brand: { displayName: string; contactEmail: string; contactPhone: string; timezone: string };
};

export const profileSchema = z.object({ displayName: z.string().min(1).max(200) });
export const brandSchema = z.object({
  displayName: z.string().min(1).max(200),
  contactEmail: z.string().email().or(z.literal("")),
  contactPhone: z.string().max(50),
  timezone: z.string().max(100),
});

export async function getSettings(ctx: RequestContext, tenantId: string): Promise<FranchisorSettings> {
  return withTenant(ctx, async (tx) => {
    const [tenant, membership] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, theme: true } }),
      tx.membership.findFirst({ where: { tenantId, clerkUserId: ctx.userId }, select: { displayName: true, email: true, role: true } }),
    ]);
    const theme = (tenant?.theme as Record<string, unknown>) ?? {};
    const contact = (theme.contact as { email?: string; phone?: string; timezone?: string; displayName?: string }) ?? {};
    return {
      profile: { displayName: membership?.displayName ?? "", email: membership?.email ?? null, role: membership?.role ?? "FRANCHISOR_ADMIN", brandName: tenant?.name ?? "" },
      brand: {
        displayName: contact.displayName ?? tenant?.name ?? "",
        contactEmail: contact.email ?? "",
        contactPhone: contact.phone ?? "",
        timezone: contact.timezone ?? "America/Toronto",
      },
    };
  });
}

export async function updateProfile(ctx: RequestContext, tenantId: string, input: z.infer<typeof profileSchema>) {
  return withTenant(ctx, async (tx) => {
    const membership = await tx.membership.findFirst({ where: { tenantId, clerkUserId: ctx.userId } });
    if (!membership) throw new HttpError(404, "Membership not found");
    await tx.membership.update({ where: { id: membership.id }, data: { displayName: input.displayName } });
    await writeAuditLog(tx, { tenantId, actorId: ctx.userId, role: ctx.role, action: "franchisorSettings.profile", entity: "Membership", entityId: membership.id, after: { displayName: input.displayName } });
  });
}

/** Writes ONLY the permitted `theme.contact` sub-object; never other theme
 *  keys (primary/logo are Kick-controlled) or tenant.name/slug/status. */
export async function updateBrand(ctx: RequestContext, tenantId: string, input: z.infer<typeof brandSchema>) {
  return withTenant(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { theme: true } });
    if (!tenant) throw new HttpError(404, "Brand not found");
    const theme = (tenant.theme as Record<string, unknown>) ?? {};
    const nextTheme = { ...theme, contact: { displayName: input.displayName, email: input.contactEmail, phone: input.contactPhone, timezone: input.timezone } };
    await tx.tenant.update({ where: { id: tenantId }, data: { theme: nextTheme } });
    await writeAuditLog(tx, { tenantId, actorId: ctx.userId, role: ctx.role, action: "franchisorSettings.brand", entity: "Tenant", entityId: tenantId, after: { contact: nextTheme.contact } });
  });
}
