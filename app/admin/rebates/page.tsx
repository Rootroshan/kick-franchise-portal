import { requireRole } from "@/server/modules/identity/guard";
import { listRebateRules } from "@/server/modules/rebates/rules";
import { listProducts } from "@/server/modules/commerce/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RebatesPanel } from "@/components/admin/RebatesPanel";

export default async function RebatesPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenantId = ctx.tenantId!;

  const [rules, products] = await Promise.all([listRebateRules(ctx, tenantId), listProducts(ctx, tenantId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Rebates</h1>
        <p className="text-sm text-muted-foreground">Rebate rules applied to commerce products.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <RebatesPanel
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            initialRules={rules.map((r) => ({
              id: r.id,
              productName: r.product.name,
              type: r.type,
              value: r.value,
              effectiveFrom: r.effectiveFrom.toISOString(),
              effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString() : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
