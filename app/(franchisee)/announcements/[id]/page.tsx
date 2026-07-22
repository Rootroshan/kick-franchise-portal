import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncements, markAnnouncementRead } from "@/server/modules/announcements/service";
import { Badge } from "@/components/ui/badge";
import { AcknowledgeButton } from "@/components/franchisee/AcknowledgeButton";
import { formatExpiry, formatPublishedAt } from "@/components/franchisee/AnnouncementFeedCard";

export const dynamic = "force-dynamic";

export default async function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("FRANCHISEE_USER")();
  // listAnnouncements already scopes to visible (published/due, non-expired)
  // + this tenant for franchisees, and includes the caller's own ack — reuse
  // it rather than adding a bespoke single-item query.
  const announcements = await listAnnouncements(ctx, ctx.tenantId);
  const announcement = announcements.find((a) => a.id === params.id);
  if (!announcement) notFound();

  // Best-effort read receipt — a failure must never break the page.
  await markAnnouncementRead(ctx, announcement.id).catch(() => {});

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/announcements"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Announcements
      </Link>

      <article className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {announcement.isPinned && (
            <Badge variant="warning" className="gap-1">
              <span aria-hidden="true">📌</span> PINNED
            </Badge>
          )}
          {announcement.requiresAck && announcement.acks.length === 0 && (
            <Badge variant="warning">Requires Acknowledgement</Badge>
          )}
        </div>

        <h1 className="mt-2 text-lg font-semibold">{announcement.title}</h1>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Published {formatPublishedAt(announcement.publishAt ?? announcement.createdAt)}
          </span>
          <span>{formatExpiry(announcement.expiresAt)}</span>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{announcement.body}</p>

        {(announcement.requiresAck || announcement.acks.length > 0) && (
          <div className="mt-6">
            <AcknowledgeButton id={announcement.id} acked={announcement.acks.length > 0} />
          </div>
        )}
      </article>
    </div>
  );
}
