import { Megaphone, CheckCircle2, Clock, Archive } from "lucide-react";
import { KPIStatCard } from "@/components/admin/kit";
import type { AnnouncementKpis } from "@/server/modules/announcements/admin";

/**
 * Right-rail "Announcement Overview" — the approved design's 2×2 tile grid
 * (Total / Published / Scheduled / Expired; Draft counts live on the Draft
 * status tab instead of a fifth tile).
 */
export function OverviewCard({ kpis }: { kpis: AnnouncementKpis }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">Announcement Overview</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <KPIStatCard label="Total" value={kpis.total} icon={Megaphone} tone="info" />
        <KPIStatCard label="Published" value={kpis.published} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Scheduled" value={kpis.scheduled} icon={Clock} tone="warning" />
        <KPIStatCard label="Expired" value={kpis.expired} icon={Archive} tone="error" />
      </div>
    </div>
  );
}
