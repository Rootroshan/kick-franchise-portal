import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { listAssignableStores } from "@/server/modules/tasks/franchisorList";
import { PageHeader } from "@/components/admin/kit";
import { BrandParamSelect } from "@/components/admin/BrandParamSelect";
import { TaskForm } from "@/components/franchisor/tasks/TaskForm";
import { createTaskAdminAction } from "../taskActions";

export const dynamic = "force-dynamic";

/**
 * KICK_ADMIN task creation. Brand is chosen via the ?brand= param so the
 * store multi-select is always server-loaded from THAT brand only — the
 * action re-verifies store↔tenant ownership regardless.
 */
export default async function NewTaskAdminPage({ searchParams }: { searchParams: { brand?: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const brands = await withTenant(ctx, (tx) =>
    tx.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  );

  const brand = brands.find((b) => b.id === searchParams.brand) ?? null;
  const stores = brand ? await listAssignableStores(ctx, brand.id) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/tasks" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>
      <PageHeader title="Create Task" description="Assign a task to one or more stores of any brand." />

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
        <BrandParamSelect brands={brands} value={brand?.id ?? ""} />

        {brand ? (
          stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">This brand has no active stores to assign tasks to.</p>
          ) : (
            <TaskForm action={createTaskAdminAction} stores={stores} tenantId={brand.id} submitLabel="Create Task" />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Select a brand to choose its stores.</p>
        )}
      </div>
    </div>
  );
}
