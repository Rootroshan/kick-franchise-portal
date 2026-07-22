import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { notifyTenantMembers } from "@/server/modules/notifications/inbox";
import { sendPushToLocationMembers } from "../push/send";

/** Runs every 1 min: flips SCHEDULED -> PUBLISHED where publishAt <= now, then fires inbox + push fan-out. */
export async function publishScheduledAnnouncements() {
  const toPublish = await withTenant(systemKickContext(), (tx) =>
    tx.announcement.findMany({
      where: { status: "SCHEDULED", publishAt: { lte: new Date() } },
    })
  );

  for (const announcement of toPublish) {
    await withTenant(systemKickContext(), (tx) =>
      tx.announcement.update({ where: { id: announcement.id }, data: { status: "PUBLISHED" } })
    );

    // Same in-app inbox fan-out the immediate-publish path fires
    // (createAnnouncement) — a cron-published announcement previously sent
    // push but never lit the bell. Status is flipped above before fan-out, so
    // the next cron run can't re-notify the same row. A fan-out failure must
    // never fail the job — the publish itself already happened.
    await notifyTenantMembers(systemKickContext(), {
      tenantId: announcement.tenantId,
      role: "FRANCHISEE_USER",
      category: "ANNOUNCEMENT",
      title: announcement.requiresAck ? `Action required: ${announcement.title}` : announcement.title,
      body: announcement.body.slice(0, 200),
      href: `/announcements/${announcement.id}`,
      entity: "Announcement",
      entityId: announcement.id,
    }).catch(() => {});

    // Spec: every store in that brand gets a push notification when it publishes.
    await sendPushToLocationMembers(announcement.tenantId, {
      title: "New announcement",
      body: announcement.title,
      url: `/announcements/${announcement.id}`,
    });
  }

  return { published: toPublish.length };
}

/** Runs every 5 min: flips PUBLISHED -> EXPIRED where expiresAt <= now. */
export async function expireAnnouncements() {
  const result = await withTenant(systemKickContext(), (tx) =>
    tx.announcement.updateMany({
      where: { status: "PUBLISHED", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    })
  );
  return { expired: result.count };
}
