import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, ShoppingCart, DollarSign, MapPin } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getStoreById } from "@/server/modules/tenants/stores";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let store;
  try {
    store = await getStoreById(ctx, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/admin/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Stores
      </Link>

      <PageHeader
        title={store.name}
        description={
          <>
            <Link href={`/admin/brands/${store.brandSlug}`} className="text-primary hover:underline">{store.brandName}</Link>
            {store.address ? ` · ${store.address}` : ""}
          </>
        }
        secondaryAction={<StatusBadge status={store.status} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Team Members" value={store.members.length} icon={Users} tone="purple" />
        <KPIStatCard label="Total Orders" value={store.orderCount} icon={ShoppingCart} tone="warning" />
        <KPIStatCard label="Revenue" value={formatCents(store.revenueCents)} icon={DollarSign} tone="success" />
        <KPIStatCard label="Location" value={store.address ? "On file" : "—"} icon={MapPin} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Team</h2>
          {store.members.length === 0 ? (
            <EmptyState title="No team members" description="Nobody is assigned to this store yet." icon={Users} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Email</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {store.members.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{m.displayName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{m.email ?? "—"}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={m.role} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent Orders</h2>
          {store.recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="This store has not placed any orders." icon={ShoppingCart} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Order</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Total</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {store.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{formatCents(o.subtotalCents)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{o.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
