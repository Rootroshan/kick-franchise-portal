import { requireRole } from "@/server/modules/identity/guard";
import { listProducts } from "@/server/modules/commerce/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommercePanel, type Product } from "@/components/admin/CommercePanel";

export default async function CommercePage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const products = await listProducts(ctx, ctx.tenantId!);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Commerce</h1>
        <p className="text-sm text-muted-foreground">Products and variants for the current tenant.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <CommercePanel initialProducts={products satisfies Product[] as Product[]} />
        </CardContent>
      </Card>
    </div>
  );
}
