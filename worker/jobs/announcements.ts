import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { fireAnnouncementPublishedFanOut } from "@/server/modules/announcements/service";

/** Runs every 1 min: flips SCHEDULED -> PUBLISHED where publishAt <= now, then fires inbox + push fan-out. */
export async function publishScheduledAnnouncements() {
  const toPublish = await withTenant(systemKickContext(), (tx) =>
    tx.announcement.findMany({
      where: { status: "SCHEDULED", publishAt: { lte: new Date() } },
    })
  );

  for (const announcement of toPublish) {
    const published = await withTenant(systemKickContext(), (tx) =>
      tx.announcement.update({ where: { id: announcement.id }, data: { status: "PUBLISHED" } })
    );

    // Same PUBLISHED fan-out the immediate-publish path fires
    // (createAnnouncement) — including the FRANCHISOR_ADMIN "New announcement
    // for your brand" bell when the creator was KICK_ADMIN. Status is flipped
    // above before fan-out, so the next cron run can't re-notify the same
    // row. A fan-out failure must never fail the job — the publish itself
    // already happened.
    await fireAnnouncementPublishedFanOut(systemKickContext(), published).catch(() => {});
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
