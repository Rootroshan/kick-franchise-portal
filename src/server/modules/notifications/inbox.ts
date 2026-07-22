import type { NotificationCategory } from "@prisma/client";
import { withTenant, systemKickContext, type RequestContext } from "@/server/db/withTenant";

/**
 * Per-user notification inbox.
 *
 * This is the read-state-bearing counterpart to the operational-signal panels.
 * The old admin badge counted live conditions (overdue tasks, failed orders)
 * which have no "read" concept, so opening the page could never clear it.
 * Unread count here is simply `readAt IS NULL` for the current user, so it
 * behaves the way a notification badge is expected to.
 *
 * RLS (notification_own_read/update) restricts every query below to the
 * caller's own rows; the explicit clerkUserId filters are defence-in-depth.
 */

export type InboxItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Unread count for the sidebar badge. */
export async function getUnreadCount(ctx: RequestContext): Promise<number> {
  return withTenant(ctx, (tx) =>
    tx.notification.count({ where: { clerkUserId: ctx.userId, readAt: null } })
  );
}

/** Inbox list, newest first. Unread first so they're not buried. */
export async function listNotifications(
  ctx: RequestContext,
  opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<InboxItem[]> {
  const { limit = 50, unreadOnly = false } = opts;
  return withTenant(ctx, (tx) =>
    tx.notification.findMany({
      where: { clerkUserId: ctx.userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true, category: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    })
  );
}

/** Mark one notification read. Idempotent — re-reading an already-read row is a no-op. */
export async function markRead(ctx: RequestContext, id: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.notification.updateMany({
      // Scoped by clerkUserId so a crafted id can't mark someone else's row.
      where: { id, clerkUserId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    })
  );
}

/** Mark every unread notification read for this user. */
export async function markAllRead(ctx: RequestContext): Promise<number> {
  const res = await withTenant(ctx, (tx) =>
    tx.notification.updateMany({
      where: { clerkUserId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    })
  );
  return res.count;
}

export type CreateNotificationInput = {
  clerkUserId: string;
  tenantId?: string | null;
  locationId?: string | null;
  category: NotificationCategory;
  title: string;
  body?: string | null;
  href?: string | null;
  entity?: string | null;
  entityId?: string | null;
};

/**
 * Create a notification. De-duplicated on
 * (clerkUserId, entity, entityId, category) by a unique index, so re-running an
 * event handler (or a worker retry) won't spam the same person twice.
 */
export async function createNotification(_ctx: RequestContext, input: CreateNotificationInput): Promise<void> {
  // The insert must run under the system context, not the actor's: Prisma's
  // create() is INSERT…RETURNING, and the Notification SELECT policy only
  // matches the RECIPIENT (or KICK_ADMIN). A franchisor fanning out to store
  // users would otherwise fail RLS on the RETURNING step and silently create
  // nothing. Inputs are always constructed by trusted server code, and the
  // caller-context membership lookup in notifyTenantMembers still enforces
  // tenant scoping on WHO gets addressed.
  await withTenant(systemKickContext(), async (tx) => {
    // Respect the recipient's per-category opt-out (Membership.notificationPrefs,
    // see notifications/prefs.ts). Every in-app notification routes through
    // here — fan-outs and direct sends alike — so this is the one place the
    // preference needs enforcing. Absent key / no membership = opted in.
    const member = await tx.membership.findFirst({
      where: { clerkUserId: input.clerkUserId, tenantId: input.tenantId ?? null },
      select: { notificationPrefs: true },
    });
    const prefs = (member?.notificationPrefs ?? {}) as Record<string, unknown>;
    if (prefs[input.category] === false) return;

    try {
      await tx.notification.create({
        data: {
          clerkUserId: input.clerkUserId,
          tenantId: input.tenantId ?? null,
          locationId: input.locationId ?? null,
          category: input.category,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
        },
      });
    } catch (e) {
      // P2002 = unique violation → this exact notification already exists.
      // That's the de-dupe working as intended, not an error worth surfacing.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  });
}

/** Fan a notification out to every member of a tenant (optionally one location). */
export async function notifyTenantMembers(
  ctx: RequestContext,
  input: Omit<CreateNotificationInput, "clerkUserId"> & { tenantId: string; role?: "FRANCHISOR_ADMIN" | "FRANCHISEE_USER" }
): Promise<number> {
  const members = await withTenant(ctx, (tx) =>
    tx.membership.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.role ? { role: input.role } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      select: { clerkUserId: true },
    })
  );

  for (const m of members) {
    await createNotification(ctx, { ...input, clerkUserId: m.clerkUserId });
  }
  return members.length;
}
