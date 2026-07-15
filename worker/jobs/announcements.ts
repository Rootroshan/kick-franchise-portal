import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { sendPushToLocationMembers } from "../push/send";

/** Runs every 1 min: flips SCHEDULED -> PUBLISHED where publishAt <= now, then fires push. */
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
