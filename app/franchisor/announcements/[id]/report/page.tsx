import { requireTenantRole } from "@/server/modules/identity/guard";
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

export default async function AnnouncementReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Widened from FRANCHISOR_ADMIN-only to match the underlying API route
  // (app/api/announcements/[id]/report/route.ts), which already allows
  // KICK_ADMIN too — the page guard was narrower than the route it backs.
  const ctx = await requireTenantRole("KICK_ADMIN", "FRANCHISOR_ADMIN")();
  const q = parseListQuery(searchParams);

  const [report, summary, users, locationOptions] = await Promise.all([
    getAcknowledgementReport(ctx, params.id, ctx.tenantId),
    getAcknowledgementSummary(ctx, ctx.tenantId, params.id),
    getAnnouncementAcknowledgementUsers(ctx, params.id, ctx.tenantId, {
      search: q.search || undefined,
      locationId: q.raw.locationId || undefined,
      page: q.page,
      limit: q.limit,
    }),
    getAnnouncementLocationOptions(ctx, ctx.tenantId),
  ]);

  await withTenant(ctx, (tx) =>
    writeAuditLog(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, role: ctx.role, action: "announcement.report_view", entity: "Announcement", entityId: params.id })
  ).catch(() => {
    // Never block viewing the report because the audit write failed.
  });

  const basePath = `/franchisor/announcements/${params.id}/report`;
  return (
    <AcknowledgementReportView
      announcementId={params.id}
      announcementTitle={report.title}
      report={report}
      summary={summary}
      users={users}
      locationOptions={locationOptions}
      backHref="/franchisor/announcements"
      pagination={{ page: q.page, pageCount: pageCount(users.total, q.limit), makeHref: (p) => buildHref(basePath, q.raw, { page: p }) }}
    />
  );
}
