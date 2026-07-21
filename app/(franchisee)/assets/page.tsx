import { getRequestContext } from "@/server/modules/identity/requestContext";
import { listAssets } from "@/server/modules/assets/service";
import { AssetGrid } from "@/components/franchisee/AssetGrid";

export default async function AssetsPage() {
  const ctx = await getRequestContext();
  const assets = await listAssets(ctx, ctx.tenantId!, {});

  const items = assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    category: a.category,
    mime: a.mime,
    sizeBytes: a.sizeBytes,
    version: a.version,
    updatedAt: a.updatedAt,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Artwork Hub</h1>
      <AssetGrid assets={items} />
    </div>
  );
}
