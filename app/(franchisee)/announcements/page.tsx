import { CheckCircle2 } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { AnnouncementsToolbar } from "@/components/franchisee/AnnouncementsToolbar";
import { FEED_TABS, type FeedTab } from "@/lib/announcementFeed";
import { AnnouncementFeedCard, PinnedRailCard, type FeedAnnouncement } from "@/components/franchisee/AnnouncementFeedCard";
import { EnablePushCard } from "@/components/franchisee/EnablePushCard";

export const dynamic = "force-dynamic";

const EMPTY_COPY: Record<FeedTab, string> = {
  All: "No announcements yet.",
  Unread: "No unread announcements.",
  Pinned: "No pinned announcements.",
  Acknowledged: "No acknowledged announcements.",
};

export default async function AnnouncementsListPage({
  searchParams,
}: {
  searchParams: { tab?: string; sort?: string; q?: string };
}) {
  // Service already restricts a FRANCHISEE_USER to visible (published / due,
  // non-expired) announcements for their own tenant, with this user's ack and
  // read rows included per row.
  const ctx = await requireRole("FRANCHISEE_USER")();
  const rows = await listAnnouncements(ctx, ctx.tenantId);

  const tab: FeedTab = (FEED_TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as FeedTab) : "All";
  const sort = searchParams.sort === "oldest" ? ("oldest" as const) : ("newest" as const);
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const all: FeedAnnouncement[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    isPinned: a.isPinned,
    requiresAck: a.requiresAck,
    publishAt: a.publishAt,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    acked: a.acks.length > 0,
    unread: a.reads.length === 0,
  }));

  // ponytail: filter/sort in memory — a tenant's visible feed is small, no new queries needed.
  let feed = all;
  if (tab === "Unread") feed = feed.filter((a) => a.unread);
  if (tab === "Pinned") feed = feed.filter((a) => a.isPinned);
  if (tab === "Acknowledged") feed = feed.filter((a) => a.acked);
  if (q) feed = feed.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
  // Pinned always leads the feed (matching the service's order); the sort
  // select flips date order within each group.
  feed = [...feed].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const at = (a.publishAt ?? a.createdAt).getTime();
    const bt = (b.publishAt ?? b.createdAt).getTime();
    return sort === "oldest" ? at - bt : bt - at;
  });

  const topPinned = all.find((a) => a.isPinned) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <AnnouncementsToolbar tab={tab} sort={sort} q={searchParams.q ?? ""} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {feed.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {q ? "No announcements match your search." : EMPTY_COPY[tab]}
            </p>
          ) : (
            <>
              {feed.map((a) => (
                <AnnouncementFeedCard key={a.id} announcement={a} />
              ))}
              <p className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> No more announcements
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          {topPinned && <PinnedRailCard announcement={topPinned} />}
          <EnablePushCard />
        </div>
      </div>
    </div>
  );
}
