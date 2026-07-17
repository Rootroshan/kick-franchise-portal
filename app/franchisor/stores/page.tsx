import Link from "next/link";
import { Store, CheckCircle2, CircleSlash, AlertTriangle, Eye } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorStores, getStoreSummary } from "@/server/modules/franchisor-dashboard/stores";
import { PageHeader, KPIStatCard, StatusBadge, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function FranchisorStoresPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const [stores, summary] = await Promise.all([listFranchisorStores(ctx, ctx.tenantId), getStoreSummary(ctx, ctx.tenantId)]);

  return (
    <div>
      <PageHeader title="Stores" description="View and manage your franchise locations." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Total Stores" value={summary.total} icon={Store} tone="info" />
        <KPIStatCard label="Active Stores" value={summary.active} icon={CheckCircle2} tone="success" />
        <KPIStatCard label="Inactive" value={summary.inactive} icon={CircleSlash} tone="warning" />
        <KPIStatCard label="Needs Attention" value={summary.needsAttention} icon={AlertTriangle} tone="error" />
      </div>

      {stores.length === 0 ? (
        <EmptyState title="No stores yet" description="Stores added to your brand will appear here." icon={Store} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Store</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Team</th>
                  <th className="px-3 py-2.5 font-medium">Engagement</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.address ?? "No address"}</div>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5 tabular-nums">{s.members}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-status-success" style={{ width: `${s.score}%` }} /></div>
                        <span className="tabular-nums text-muted-foreground">{s.score}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/franchisor/stores/${s.id}`} className="rounded p-1.5 hover:bg-muted" aria-label="View store"><Eye className="h-4 w-4" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {stores.map((s) => (
              <li key={s.id}>
                <Link href={`/franchisor/stores/${s.id}`} className="block rounded-xl border border-border bg-card p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">{s.address ?? "No address"}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{s.members} team</span>
                    <span className="font-medium">{s.score}% engaged</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
