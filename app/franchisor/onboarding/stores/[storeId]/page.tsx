import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { PageHeader, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function StoreOnboardingPage({ params }: { params: { storeId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  const data = await withTenant(ctx, async (tx) => {
    const store = await tx.location.findFirst({ where: { id: params.storeId, tenantId: ctx.tenantId }, select: { id: true, name: true } });
    if (!store) return null;
    const progress = await tx.onboardingProgress.findMany({
      where: { locationId: store.id, item: { template: { tenantId: ctx.tenantId } } },
      select: { done: true, doneAt: true, item: { select: { title: true, order: true, template: { select: { name: true } } } } },
      orderBy: { item: { order: "asc" } },
    });
    return { store, progress };
  });

  if (!data) notFound();
  const { store, progress } = data;
  const done = progress.filter((p) => p.done).length;
  const pct = progress.length === 0 ? 0 : Math.round((done / progress.length) * 100);

  return (
    <div>
      <Link href="/franchisor/onboarding?view=progress" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Store Progress
      </Link>

      <PageHeader title={store.name} description={`Onboarding progress · ${done}/${progress.length} steps complete (${pct}%)`} />

      {progress.length === 0 ? (
        <EmptyState title="No onboarding assigned" description="This store has no onboarding steps recorded yet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul>
            {progress.map((p, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                {p.done ? <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.item.title}</div>
                  <div className="text-xs text-muted-foreground">{p.item.template.name}</div>
                </div>
                <span className="text-xs text-muted-foreground">{p.done && p.doneAt ? p.doneAt.toLocaleDateString() : "Pending"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
