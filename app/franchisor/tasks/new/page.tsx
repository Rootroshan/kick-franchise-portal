import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { listAssignableStores } from "@/server/modules/tasks/franchisorList";
import { PageHeader } from "@/components/admin/kit";
import { TaskForm } from "@/components/franchisor/tasks/TaskForm";
import { createTaskAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const stores = await listAssignableStores(ctx, ctx.tenantId);

  return (
    <div className="max-w-2xl">
      <Link href="/franchisor/tasks" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>
      <PageHeader title="Create Task" description="Each selected store gets its own assignment to complete independently." />
      <div className="rounded-xl border border-border bg-card p-5">
        <TaskForm action={createTaskAction} stores={stores} submitLabel="Create Task" />
      </div>
    </div>
  );
}
