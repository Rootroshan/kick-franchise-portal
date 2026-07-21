import Link from "next/link";
import { Plus, ListChecks, Eye } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listTemplates, storeProgress } from "@/server/modules/onboarding/franchisorList";
import { PageHeader, StatusBadge, PrimaryButtonLink, EmptyState } from "@/components/admin/kit";
import { FilterTabs } from "@/components/franchisor/shared/FilterTabs";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: { view?: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const view = searchParams.view === "progress" ? "progress" : "templates";

  const [templates, progress] = await Promise.all([listTemplates(ctx, ctx.tenantId), view === "progress" ? storeProgress(ctx, ctx.tenantId) : Promise.resolve([])]);

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Create onboarding templates and monitor store progress."
        action={<PrimaryButtonLink href="/franchisor/onboarding/new"><Plus className="h-4 w-4" /> New Template</PrimaryButtonLink>}
      />

      <FilterTabs
        paramKey="view"
        tabs={[
          { value: "", label: "Templates", count: templates.length },
          { value: "progress", label: "Store Progress" },
        ]}
      />

      {view === "templates" ? (
        templates.length === 0 ? (
          <EmptyState title="No onboarding templates" description="Create a template to track store setup." icon={ListChecks} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Link key={t.id} href={`/franchisor/onboarding/${t.id}`} className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.itemCount} steps</span>
                  <span>{t.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${t.percent === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${t.percent}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t.storesCompleted}/{t.storesAssigned} stores complete</div>
              </Link>
            ))}
          </div>
        )
      ) : progress.length === 0 ? (
        <EmptyState title="No stores" description="Active stores will appear here with their onboarding progress." icon={ListChecks} />
      ) : (
        <>
          <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Store</th>
                  <th className="px-3 py-2.5 font-medium">Current Step</th>
                  <th className="px-3 py-2.5 font-medium">Progress</th>
                  <th className="px-3 py-2.5 font-medium">Last Activity</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((s) => (
                  <tr key={s.locationId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{s.storeName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.currentStep}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${s.percent === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${s.percent}%` }} /></div>
                        <span className="text-xs tabular-nums">{s.percent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.lastActivity ? s.lastActivity.toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status === "not_started" ? "draft" : s.status === "completed" ? "completed" : "processing"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {progress.map((s) => (
              <li key={s.locationId} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{s.storeName}</span>
                  <StatusBadge status={s.status === "not_started" ? "draft" : s.status === "completed" ? "completed" : "processing"} />
                </div>
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${s.percent === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${s.percent}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{s.currentStep}</span><span>{s.percent}%</span></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
