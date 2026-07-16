import { requireRole } from "@/server/modules/identity/guard";
import { listAllowances } from "@/server/modules/allowances/admin";
import { listLocations } from "@/server/modules/tenants/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllowancesPanel } from "@/components/admin/AllowancesPanel";

export default async function AllowancesPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = ctx.tenantId;

  const [allowances, locations] = await Promise.all([listAllowances(ctx, tenantId), listLocations(ctx, tenantId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Allowances</h1>
        <p className="text-sm text-muted-foreground">Grant per-location spending allowances for a period.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Grants</CardTitle>
        </CardHeader>
        <CardContent>
          <AllowancesPanel
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            initialAllowances={allowances.map((a) => ({
              id: a.id,
              locationName: a.location.name,
              periodLabel: a.periodLabel,
              grantedCents: a.grantedCents,
              currency: a.currency,
              overflow: a.overflow,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
