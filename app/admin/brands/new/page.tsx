import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { PageHeader } from "@/components/admin/kit";
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  await requireRole("KICK_ADMIN")();
  return (
    <div className="max-w-xl">
      <Link href="/admin/brands" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Brands
      </Link>
      <PageHeader title="New Brand" description="Provision a new franchise brand. It gets its own portal instantly." />
      <div className="rounded-xl border border-border bg-card p-5">
        <CreateTenantForm />
      </div>
    </div>
  );
}
