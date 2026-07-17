import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { AnnouncementCard } from "@/components/franchisee/AnnouncementCard";

export const dynamic = "force-dynamic";

export default async function AnnouncementsListPage() {
  // Service already restricts a FRANCHISEE_USER to PUBLISHED, non-expired
  // announcements for their own tenant (scheduled/draft/expired hidden).
  const ctx = await requireRole("FRANCHISEE_USER")();
  const announcements = await listAnnouncements(ctx, ctx.tenantId);

  const pinned = announcements.filter((a) => a.isPinned);
  const rest = announcements.filter((a) => !a.isPinned);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Announcements</h1>

      {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}

      {pinned.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Pinned</h2>
          {pinned.map((a) => (
            <AnnouncementCard key={a.id} id={a.id} title={a.title} body={a.body} createdAt={a.createdAt.toISOString()} requiresAck={a.requiresAck} acked={a.acks.length > 0} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          {pinned.length > 0 && <h2 className="text-xs font-semibold uppercase text-muted-foreground">All</h2>}
          {rest.map((a) => (
            <AnnouncementCard key={a.id} id={a.id} title={a.title} body={a.body} createdAt={a.createdAt.toISOString()} requiresAck={a.requiresAck} acked={a.acks.length > 0} />
          ))}
        </div>
      )}
    </div>
  );
}
