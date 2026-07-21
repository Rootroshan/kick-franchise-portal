import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Pin, CheckCircle2, XCircle, Users } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorAnnouncement } from "@/server/modules/announcements/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader, StatusBadge } from "@/components/admin/kit";
import { AnnouncementActions } from "@/components/franchisor/announcements/AnnouncementActions";

export const dynamic = "force-dynamic";

export default async function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let a;
  try {
    a = await getFranchisorAnnouncement(ctx, ctx.tenantId, params.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  const ackPercent = a.requiresAck && a.targetStores > 0 ? Math.round((a.acknowledged.length / a.targetStores) * 100) : 0;

  return (
    <div>
      <Link href="/franchisor/announcements" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Announcements
      </Link>

      <PageHeader
        title={a.title}
        description={`Created ${a.createdAt.toLocaleString()}${a.publishAt ? ` · Publishes ${a.publishAt.toLocaleString()}` : ""}`}
        secondaryAction={
          <span className="flex items-center gap-1.5">
            {a.isPinned && <Pin className="h-4 w-4 text-status-warning" aria-label="Pinned" />}
            <StatusBadge status={a.status} />
          </span>
        }
        action={
          <Link href={`/franchisor/announcements/${a.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        }
      />

      <div className="mb-4">
        <AnnouncementActions id={a.id} isPinned={a.isPinned} status={a.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">Content</h2>
            <p className="whitespace-pre-wrap text-sm">{a.body}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4" /> Delivery</h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Target stores" value={String(a.targetStores)} />
              <Row label="Requires ack" value={a.requiresAck ? "Yes" : "No"} />
              {a.requiresAck && <Row label="Acknowledged" value={`${a.acknowledged.length} / ${a.targetStores} (${ackPercent}%)`} />}
              <Row label="Expires" value={a.expiresAt ? a.expiresAt.toLocaleDateString() : "Never"} />
            </dl>
            {a.requiresAck && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-status-success" style={{ width: `${ackPercent}%` }} />
              </div>
            )}
          </div>

          {a.requiresAck && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Acknowledgement Breakdown</h2>
                <Link href={`/franchisor/announcements/${a.id}/report`} className="text-xs font-medium text-status-info hover:underline">
                  Full report →
                </Link>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {a.acknowledged.map((k, i) => (
                  <li key={`ack-${i}`} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />
                    <span className="flex-1 truncate">{k.locationName}</span>
                    <span className="text-xs text-muted-foreground">{k.acknowledgedAt.toLocaleDateString()}</span>
                  </li>
                ))}
                {a.notAcknowledged.map((name, i) => (
                  <li key={`nack-${i}`} className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span className="flex-1 truncate">{name}</span>
                    <span className="text-xs">Pending</span>
                  </li>
                ))}
                {a.acknowledged.length === 0 && a.notAcknowledged.length === 0 && <li className="text-muted-foreground">No stores targeted.</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
