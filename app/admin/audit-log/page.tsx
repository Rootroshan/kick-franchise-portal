import { ScrollText, Clock, Users } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAuditLogsAdmin, getAuditKpis, getAuditEntityOptions } from "@/server/modules/identity/auditList";
import { getBrandFilterOptions } from "@/server/modules/tenants/stores";
import { parseListQuery, buildHref, pageCount } from "@/lib/adminQuery";
import { PageHeader, KPIStatCard, StatusBadge, Pagination } from "@/components/admin/kit";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { AuditRow } from "@/server/modules/identity/auditList";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const q = parseListQuery(searchParams);
  const [{ rows, total }, kpis, brandOptions, entityOptions] = await Promise.all([
    listAuditLogsAdmin(ctx, q),
    getAuditKpis(ctx),
    getBrandFilterOptions(ctx),
    getAuditEntityOptions(ctx),
  ]);
  const pages = pageCount(total, q.limit);

  const columns: Column<AuditRow>[] = [
    {
      key: "action",
      header: "Action",
      cell: (l) => (
        <div>
          <div className="font-mono text-xs font-medium text-foreground">{l.action}</div>
          <div className="text-xs text-muted-foreground">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</div>
        </div>
      ),
    },
    { key: "actor", header: "Actor", hideOnMobile: true, cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.actorId}</span> },
    { key: "role", header: "Role", cell: (l) => <StatusBadge status={l.role} /> },
    { key: "brand", header: "Brand", hideOnMobile: true, cell: (l) => <span className="text-muted-foreground">{l.brandName ?? "Platform"}</span> },
    { key: "when", header: "When", cell: (l) => <span className="text-muted-foreground">{l.createdAt.toLocaleString()}</span> },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every privileged action across the platform, immutably recorded." />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPIStatCard label="Total Events" value={kpis.total} icon={ScrollText} tone="info" />
        <KPIStatCard label="Last 24h" value={kpis.last24h} icon={Clock} tone="warning" />
        <KPIStatCard label="Distinct Actors" value={kpis.distinctActors} icon={Users} tone="purple" />
      </div>

      <ListToolbar
        searchPlaceholder="Search by action, entity, or actor…"
        filters={[
          { key: "brand", label: "Brand", options: brandOptions },
          { key: "entity", label: "Entity", options: entityOptions },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(l) => l.id}
        basePath="/admin/audit-log"
        currentParams={q.raw}
        sort={q.sort}
        direction={q.direction}
        empty={{ title: "No audit events found", description: q.search || q.brand ? "Try different filters." : "Privileged actions are recorded here." }}
      />

      <div className="flex items-center justify-between">
        <p className="mt-3 text-xs text-muted-foreground">{total} event{total === 1 ? "" : "s"} total</p>
        <Pagination page={q.page} pageCount={pages} makeHref={(p) => buildHref("/admin/audit-log", q.raw, { page: p })} />
      </div>
    </div>
  );
}
