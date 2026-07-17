import { Store } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listFranchisorStores } from "@/server/modules/franchisor-dashboard/stores";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function FranchisorStoresPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const stores = await listFranchisorStores(ctx, ctx.tenantId);

  return (
    <div>
      <PageHeader title="Stores" description="Your brand's store locations and their engagement scores." />
      {stores.length === 0 ? (
        <EmptyState title="No stores yet" description="Stores added to your brand will appear here." icon={Store} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Store</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Team</th>
                <th className="px-3 py-2.5 font-medium">Engagement</th>
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
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-status-success" style={{ width: `${s.score}%` }} />
                      </div>
                      <span className="tabular-nums text-muted-foreground">{s.score}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
