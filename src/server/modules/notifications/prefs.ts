import { z } from "zod";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";
import { HttpError } from "@/server/modules/identity/errors";
import { PREF_CATEGORIES, type PrefCategory } from "@/lib/notificationPrefs";

/**
 * Per-member notification category opt-outs, stored as a Json map on the
 * caller's own Membership row: { "ANNOUNCEMENT": false } means opted out.
 * Absent key = opted in, so existing members need no backfill.
 *
 * Enforcement lives in createNotification() (inbox.ts) — the single choke
 * point every in-app notification passes through.
 */

const prefsSchema = z
  .object({
    ANNOUNCEMENT: z.boolean().optional(),
    TASK: z.boolean().optional(),
    ONBOARDING: z.boolean().optional(),
    ORDER: z.boolean().optional(),
  })
  .strict();

/** Effective prefs for the caller — every known category, defaulting to on. */
export async function getOwnNotificationPrefs(ctx: RequestContext): Promise<Record<PrefCategory, boolean>> {
  // membership_self_read RLS policy lets any member SELECT their own row.
  const m = await withTenant(ctx, (tx) =>
    tx.membership.findFirst({
      where: { clerkUserId: ctx.userId, tenantId: ctx.tenantId },
      select: { notificationPrefs: true },
    })
  );
  const stored = (m?.notificationPrefs ?? {}) as Record<string, unknown>;
  return Object.fromEntries(PREF_CATEGORIES.map((c) => [c, stored[c] !== false])) as Record<PrefCategory, boolean>;
}

/**
 * Merge-updates the caller's own opt-outs. Runs under system authority because
 * RLS makes Membership SELECT-only for non-Kick roles; the where-clause is
 * derived entirely from the server context, so only the caller's own row can
 * ever be written.
 */
export async function setOwnNotificationPrefs(ctx: RequestContext, input: unknown): Promise<void> {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.tenantId) {
    throw new HttpError(403, "Forbidden");
  }
  const parsed = prefsSchema.parse(input);

  await withTenant(systemKickContext(), async (tx) => {
    const m = await tx.membership.findFirst({
      where: { clerkUserId: ctx.userId, tenantId: ctx.tenantId },
      select: { id: true, notificationPrefs: true },
    });
    if (!m) throw new HttpError(404, "Membership not found");

    const merged = { ...((m.notificationPrefs ?? {}) as Record<string, boolean>), ...parsed };
    await tx.membership.update({ where: { id: m.id }, data: { notificationPrefs: merged } });
  });
}
