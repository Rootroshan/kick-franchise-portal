import { notFound } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { AnnouncementCard } from "@/components/franchisee/AnnouncementCard";

export default async function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getRequestContext();
  // listAnnouncements already scopes to PUBLISHED + non-expired + this tenant for franchisees,
  // and includes the caller's own ack — reuse it rather than adding a bespoke single-item query.
  const announcements = await listAnnouncements(ctx, ctx.tenantId!);
  const announcement = announcements.find((a) => a.id === params.id);
  if (!announcement) notFound();

  return (
    <AnnouncementCard
      id={announcement.id}
      title={announcement.title}
      body={announcement.body}
      createdAt={announcement.createdAt.toISOString()}
      requiresAck={announcement.requiresAck}
      acked={announcement.acks.length > 0}
      full
    />
  );
}
