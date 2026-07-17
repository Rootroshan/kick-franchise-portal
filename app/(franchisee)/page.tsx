import Link from "next/link";
import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { getOwnAllowanceBalance } from "@/server/modules/allowances/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";
import { AnnouncementCard } from "@/components/franchisee/AnnouncementCard";
import { PushOptIn } from "@/components/franchisee/PushOptIn";

export default async function FeedPage() {
  // Self-enforce the franchisee requirement here rather than relying on the
  // layout's redirect — a FRANCHISEE_USER always has a resolved tenant, so
  // no non-null assertion smell. The layout still redirects other roles away
  // first; this is the belt to its suspenders.
  const ctx = await requireRole("FRANCHISEE_USER")();
  const [announcements, balances] = await Promise.all([
    listAnnouncements(ctx, ctx.tenantId),
    getOwnAllowanceBalance(ctx),
  ]);

  const pinned = announcements.filter((a) => a.isPinned);
  const recent = announcements.filter((a) => !a.isPinned);
  const totalBalanceCents = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <PushOptIn />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Allowance balance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end justify-between pt-0">
          <div>
            <div className="text-2xl font-bold">{formatCents(totalBalanceCents)}</div>
            {balances.map((b) => (
              <div key={b.allowanceId} className="text-xs text-muted-foreground">
                {b.periodLabel}: {formatCents(b.balanceCents, b.currency)}
              </div>
            ))}
            {balances.length === 0 && <div className="text-xs text-muted-foreground">No active allowance period</div>}
          </div>
          <Link href="/shop" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            Shop now
          </Link>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {pinned.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Pinned</h2>
            {pinned.map((a) => (
              <AnnouncementCard
                key={a.id}
                id={a.id}
                title={a.title}
                body={a.body}
                createdAt={a.createdAt.toISOString()}
                requiresAck={a.requiresAck}
                acked={a.acks.length > 0}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Recent</h2>
          {recent.length === 0 && pinned.length === 0 && (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}
          {recent.map((a) => (
            <AnnouncementCard
              key={a.id}
              id={a.id}
              title={a.title}
              body={a.body}
              createdAt={a.createdAt.toISOString()}
              requiresAck={a.requiresAck}
              acked={a.acks.length > 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
