import { requireRole } from "@/server/modules/identity/guard";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementsPanel } from "@/components/franchisor/AnnouncementsPanel";

export default async function AnnouncementsPage() {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const announcements = await listAnnouncements(ctx, ctx.tenantId!);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Create and manage announcements for your locations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementsPanel
            initialAnnouncements={announcements.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              isPinned: a.isPinned,
              status: a.status,
              publishAt: a.publishAt ? a.publishAt.toISOString() : null,
              expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
              requiresAck: a.requiresAck,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
