import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getTemplateDetail } from "@/server/modules/onboarding/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params }: { params: { templateId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let t;
  try {
    t = await getTemplateDetail(ctx, ctx.tenantId, params.templateId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/franchisor/onboarding" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Onboarding
      </Link>

      <PageHeader
        title={t.name}
        description={`${t.steps.length} steps · ${t.storesCompleted}/${t.storesAssigned} stores complete`}
        action={
          <Link href={`/franchisor/onboarding/${t.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Overall completion</span>
          <span className="text-2xl font-bold tabular-nums">{t.percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${t.percent === 100 ? "bg-status-success" : "bg-primary"}`} style={{ width: `${t.percent}%` }} />
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Steps</h2>
      <div className="scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Step</th>
              <th className="px-3 py-2.5 font-medium">Stores Completed</th>
              <th className="px-3 py-2.5 font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {t.steps.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-muted-foreground">{s.order + 1}</td>
                <td className="px-3 py-2.5 font-medium">{s.title}</td>
                <td className="px-3 py-2.5 tabular-nums">{s.storesCompleted}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-status-success" style={{ width: `${s.percent}%` }} /></div>
                    <span className="text-xs tabular-nums">{s.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
