import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorTask } from "@/server/modules/tasks/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";
import { TaskForm } from "@/components/franchisor/tasks/TaskForm";
import { updateTaskAction } from "../../actions";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditTaskPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let t;
  try {
    t = await getFranchisorTask(ctx, ctx.tenantId, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const update = updateTaskAction.bind(null, params.id);

  return (
    <div className="max-w-2xl">
      <Link href={`/franchisor/tasks/${t.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="Edit Task" description="Update task details. Store assignments are managed on the task page." />
      <div className="rounded-xl border border-border bg-card p-5">
        <TaskForm action={update} submitLabel="Save Changes" defaultValues={{ title: t.title, details: t.details ?? "", dueAt: toLocalInput(t.dueAt) }} />
      </div>
    </div>
  );
}
