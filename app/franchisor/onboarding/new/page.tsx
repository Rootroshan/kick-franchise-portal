import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { PageHeader } from "@/components/admin/kit";
import { TemplateForm } from "@/components/franchisor/onboarding/TemplateForm";
import { createTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  await requireTenantRole("FRANCHISOR_ADMIN")();
  return (
    <div className="max-w-2xl">
      <Link href="/franchisor/onboarding" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Onboarding
      </Link>
      <PageHeader title="New Onboarding Template" description="Add the steps every new store must complete, in order." />
      <div className="rounded-xl border border-border bg-card p-5">
        <TemplateForm action={createTemplateAction} submitLabel="Create Template" />
      </div>
    </div>
  );
}
