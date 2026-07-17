import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getOnboardingDetail } from "@/server/modules/onboarding/admin";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function OnboardingDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let tpl;
  try {
    tpl = await getOnboardingDetail(ctx, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/admin/onboarding" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Onboarding
      </Link>

      <PageHeader
        title={tpl.name}
        description={
          <Link href={`/admin/brands/${tpl.brandSlug}`} className="text-primary hover:underline">{tpl.brandName}</Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Steps ({tpl.items.length})</h2>
          {tpl.items.length === 0 ? (
            <EmptyState title="No steps" description="This template has no checklist items." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {tpl.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-0">
                  <span className="text-sm">{it.order}. {it.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {it.doneCount > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-status-success" /> : <Circle className="h-3.5 w-3.5" />}
                    {it.doneCount} store{it.doneCount === 1 ? "" : "s"} done
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Store Progress ({tpl.stores.length})</h2>
          {tpl.stores.length === 0 ? (
            <EmptyState title="No stores" description="This brand has no stores to track." />
          ) : (
            <div className="flex flex-col gap-2">
              {tpl.stores.map((s) => {
                const pct = s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
                return (
                  <div key={s.locationId} className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.storeName}</span>
                      <span className="tabular-nums text-muted-foreground">{s.done}/{s.total}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${pct === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
