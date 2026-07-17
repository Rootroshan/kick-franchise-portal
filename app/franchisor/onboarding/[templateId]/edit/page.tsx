import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getTemplateDetail } from "@/server/modules/onboarding/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";
import { TemplateForm } from "@/components/franchisor/onboarding/TemplateForm";
import { updateTemplateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { templateId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let t;
  try {
    t = await getTemplateDetail(ctx, ctx.tenantId, params.templateId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const update = updateTemplateAction.bind(null, params.templateId);

  return (
    <div className="max-w-2xl">
      <Link href={`/franchisor/onboarding/${t.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="Edit Template" description="Reorder, add, or remove steps. Removing a step clears its recorded progress." />
      <div className="rounded-xl border border-border bg-card p-5">
        <TemplateForm action={update} submitLabel="Save Changes" defaultValues={{ name: t.name, steps: t.steps.map((s) => s.title) }} />
      </div>
    </div>
  );
}
