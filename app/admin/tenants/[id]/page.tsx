import { notFound } from "next/navigation";
import { requireRole } from "@/server/modules/identity/guard";
import { listLocations, listCustomDomains, listMemberships } from "@/server/modules/tenants/service";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationsPanel } from "@/components/admin/LocationsPanel";
import { DomainsPanel } from "@/components/admin/DomainsPanel";
import { MembersPanel } from "@/components/admin/MembersPanel";

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  const tenant = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: params.id } }));
  if (!tenant) notFound();

  const [locations, domains, members] = await Promise.all([
    listLocations(ctx, tenant.id),
    listCustomDomains(ctx, tenant.id),
    listMemberships(ctx, tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <p className="text-sm text-muted-foreground">/{tenant.slug} · {tenant.status}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationsPanel tenantId={tenant.id} initialLocations={locations} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom domains</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainsPanel tenantId={tenant.id} initialDomains={domains} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersPanel tenantId={tenant.id} initialMembers={members} />
        </CardContent>
      </Card>
    </div>
  );
}
