import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import {
  getAcknowledgementReport,
  getAcknowledgementSummary,
  getAnnouncementAcknowledgementUsers,
  getAnnouncementLocationOptions,
} from "@/server/modules/announcements/service";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { AcknowledgementReportView } from "@/components/admin/announcements/AcknowledgementReportView";

export const dynamic = "force-dynamic";

/** KICK_ADMIN cross-tenant acknowledgement report — tenantId is resolved from
 *  the announcement itself (getAcknowledgementReport with tenantId omitted),
 *  never client-trusted. */
export default async function AdminAnnouncementReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);

  const report = await getAcknowledgementReport(ctx, params.id);
  const [summary, users, locationOptions] = await Promise.all([
    getAcknowledgementSummary(ctx, report.tenantId, params.id),
    getAnnouncementAcknowledgementUsers(ctx, params.id, report.tenantId, {
      search: q.search || undefined,
      locationId: q.raw.locationId || undefined,
      page: q.page,
      limit: q.limit,
    }),
    getAnnouncementLocationOptions(ctx, report.tenantId),
  ]);

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, { tenantId: report.tenantId, actorId: ctx.userId, role: ctx.role, action: "announcement.report_view", entity: "Announcement", entityId: params.id })
  ).catch(() => {
    // Never block viewing the report because the audit write failed.
  });

  const basePath = `/admin/announcements/${params.id}/report`;
  return (
    <AcknowledgementReportView
      announcementId={params.id}
      announcementTitle={report.title}
      tenantId={report.tenantId}
      report={report}
      summary={summary}
      users={users}
      locationOptions={locationOptions}
      backHref="/admin/announcements"
      pagination={{ page: q.page, pageCount: pageCount(users.total, q.limit), makeHref: (p) => buildHref(basePath, q.raw, { page: p }) }}
    />
  );
}
