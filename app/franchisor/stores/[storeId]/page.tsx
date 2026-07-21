import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, ClipboardList, ListChecks, Megaphone, Download, ClipboardCheck } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorStoreDetail } from "@/server/modules/franchisor-dashboard/stores";
import { PageHeader, KPIStatCard, StatusBadge, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function StoreDetailPage({ params }: { params: { storeId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const store = await getFranchisorStoreDetail(ctx, ctx.tenantId, params.storeId);
  if (!store) notFound();

  return (
    <div>
      <Link href="/franchisor/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Stores
      </Link>

      <PageHeader title={store.name} description={store.address ?? "No address on file"} secondaryAction={<StatusBadge status={store.status} />} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIStatCard label="Team Members" value={store.members.length} icon={Users} tone="purple" />
        <KPIStatCard label="Open Tasks" value={store.openTasks} icon={ClipboardList} tone="warning" />
        <KPIStatCard label="Onboarding" value={`${store.onboardingPercent}%`} icon={ListChecks} tone="info" />
        <KPIStatCard label="Engagement" value={`${store.score}%`} icon={ClipboardCheck} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Team</h2>
          {store.members.length === 0 ? (
            <EmptyState title="No team members" description="Nobody is assigned to this store yet." icon={Users} />
          ) : (
            <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
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
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 font-medium">{m.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{m.email ?? "—"}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={m.role} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Engagement</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Metric icon={Megaphone} label="Announcement acks" value={store.announcementAcks} />
            <Metric icon={ClipboardList} label="Tasks completed" value={store.completedTasks} />
            <Metric icon={ListChecks} label="Onboarding" value={`${store.onboardingPercent}%`} />
            <Metric icon={Download} label="Artwork downloads" value={store.artworkDownloads} />
          </dl>
          <div className="mt-4">
            <Link href={`/franchisor/onboarding/stores/${store.id}`} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border py-1.5 text-sm font-medium hover:bg-muted">
              View onboarding
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" /> {label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
