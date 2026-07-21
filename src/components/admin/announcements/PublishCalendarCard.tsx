import { getAnnouncementPublishCalendar } from "@/server/modules/announcements/admin";
import type { RequestContext } from "@/server/db/withTenant";
import { PublishCalendar } from "./PublishCalendar";

/** Server wrapper: resolves the month to show (from ?cy=&cm= or today) and fetches its data. */
export async function PublishCalendarCard({
  ctx,
  tenantId,
  raw,
}: {
  ctx: RequestContext;
  tenantId: string | undefined;
  raw: Record<string, string>;
}) {
  const now = new Date();
  const year = Number(raw.cy) || now.getFullYear();
  const month = Number(raw.cm) || now.getMonth() + 1;

  const days = await getAnnouncementPublishCalendar(ctx, tenantId, year, month);
  return <PublishCalendar year={year} month={month} days={days} />;
}
