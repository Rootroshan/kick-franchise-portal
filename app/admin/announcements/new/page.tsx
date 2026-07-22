import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { AnnouncementComposer } from "@/components/announcements/AnnouncementComposer";
import { createAnnouncementAdminAction } from "../announcementActions";

export const dynamic = "force-dynamic";

export default async function NewAnnouncementAdminPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const brands = await withTenant(ctx, (tx) => tx.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <AnnouncementComposer
        action={createAnnouncementAdminAction}
        backHref="/admin/announcements"
        title="Create Announcement"
        description="Publish an announcement immediately or schedule it for later, for any brand. Important updates can also require acknowledgement from stores."
        brands={brands}
      />
    </div>
  );
}
