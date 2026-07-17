import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorAnnouncement } from "@/server/modules/announcements/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";
import { AnnouncementForm } from "@/components/franchisor/announcements/AnnouncementForm";
import { updateAnnouncementAction } from "../../actions";

export const dynamic = "force-dynamic";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditAnnouncementPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let a;
  try {
    a = await getFranchisorAnnouncement(ctx, ctx.tenantId, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const update = updateAnnouncementAction.bind(null, params.id);

  return (
    <div className="max-w-2xl">
      <Link href={`/franchisor/announcements/${a.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="Edit Announcement" description="Update the content, schedule, or acknowledgement settings." />
      <div className="rounded-xl border border-border bg-card p-5">
        <AnnouncementForm
          action={update}
          submitLabel="Save Changes"
          defaultValues={{
            title: a.title,
            body: a.body,
            isPinned: a.isPinned,
            requiresAck: a.requiresAck,
            publishAt: toLocalInput(a.publishAt),
            expiresAt: toLocalInput(a.expiresAt),
          }}
        />
      </div>
    </div>
  );
}
