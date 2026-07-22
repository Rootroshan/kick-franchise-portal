import type { NotificationCategory } from "@prisma/client";
import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { sendPushToSubscription, type PushPayload } from "@/server/lib/push";

/**
 * Fans out a push notification to every push subscription belonging to a
 * Membership in the given tenant. Falls back to email per-recipient on
 * push failure (spec §15). Dead subscriptions are marked for later cleanup
 * by the pruneDeadSubscriptions job, not deleted synchronously here.
 *
 * `category` gates this the same way createNotification() gates the in-app
 * fan-out (Membership.notificationPrefs[category] === false = opted out):
 * push/email is a separate delivery channel from the in-app inbox, so it
 * needs its own check on the same preference rather than inheriting one.
 */
export async function sendPushToLocationMembers(
  tenantId: string,
  payload: PushPayload,
  locationId: string | undefined,
  category: NotificationCategory
) {
  const memberships = await withTenant(systemKickContext(), (tx) =>
    tx.membership.findMany({
      where: { tenantId, ...(locationId ? { locationId } : {}) },
    })
  ).then((rows) =>
    rows.filter((m) => (m.notificationPrefs as Record<string, unknown>)[category] !== false)
  );

  const clerkUserIds = memberships.map((m) => m.clerkUserId);
  if (clerkUserIds.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const subscriptions = await withTenant(systemKickContext(), (tx) =>
    tx.pushSubscription.findMany({
      where: { clerkUserId: { in: clerkUserIds }, status: { not: "DEAD" } },
    })
  );

  let sent = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    const membership = memberships.find((m) => m.clerkUserId === sub.clerkUserId);
    const emailFallback = membership?.email
      ? { to: membership.email, subject: payload.title, html: `<p>${payload.body}</p>` }
      : undefined;

    const result = await sendPushToSubscription(sub.id, payload, emailFallback);
    if (result.ok) sent++;
    else failed++;
  }

  return { attempted: subscriptions.length, sent, failed };
}
