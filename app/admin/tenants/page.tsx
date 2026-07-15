import Link from "next/link";
import { requireRole } from "@/server/modules/identity/guard";
import { listTenants } from "@/server/modules/tenants/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";

export default async function TenantsPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenants = await listTenants(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Tenants</h1>
        <p className="text-sm text-muted-foreground">All franchisor brands on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTenantForm />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <Link key={t.id} href={`/admin/tenants/${t.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={t.status === "active" ? "success" : "warning"}>{t.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">/{t.slug}</CardContent>
            </Card>
          </Link>
        ))}
        {tenants.length === 0 && <p className="text-sm text-muted-foreground">No tenants yet.</p>}
      </div>
    </div>
  );
}
