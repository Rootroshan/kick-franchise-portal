import { requireRole } from "@/server/modules/identity/guard";
import { listAssets } from "@/server/modules/assets/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetsPanel } from "@/components/franchisor/AssetsPanel";

export default async function AssetsPage() {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();
  const assets = await listAssets(ctx, ctx.tenantId!, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Artwork Hub</h1>
        <p className="text-sm text-muted-foreground">Upload and manage brand assets for your locations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetsPanel
            initialAssets={assets.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              category: a.category,
              status: a.status,
              mime: a.mime,
              sizeBytes: a.sizeBytes,
              version: a.version,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
