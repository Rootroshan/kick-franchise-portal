import { Megaphone, CheckCircle2, Clock, FileEdit, Archive } from "lucide-react";
import { KPIStatCard } from "@/components/admin/kit";
import type { AnnouncementKpis } from "@/server/modules/announcements/admin";

/** Right-rail "Announcement Overview" — 5-tile KPI grid, server component. */
export function OverviewCard({ kpis }: { kpis: AnnouncementKpis }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">Overview</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <KPIStatCard label="Total" value={kpis.total} icon={Megaphone} tone="info" />
        <KPIStatCard label="Published" value={kpis.published} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Scheduled" value={kpis.scheduled} icon={Clock} tone="warning" />
        <KPIStatCard label="Draft" value={kpis.drafts} icon={FileEdit} tone="info" />
        <KPIStatCard label="Expired" value={kpis.expired} icon={Archive} tone="error" />
      </div>
    </div>
  );
}
