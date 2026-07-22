import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { AnnouncementComposer } from "@/components/announcements/AnnouncementComposer";
import { createAnnouncementAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const tenant = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <AnnouncementComposer
        action={createAnnouncementAction}
        backHref="/franchisor/announcements"
        title="Create Announcement"
        description="Publish an announcement immediately or schedule it for later. Important updates can also require acknowledgement from stores."
        brandName={tenant?.name ?? "Your brand"}
      />
    </div>
  );
}
