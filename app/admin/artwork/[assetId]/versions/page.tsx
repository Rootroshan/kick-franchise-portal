import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getAssetVersionHistory } from "@/server/modules/assets/service";
import { getAssetAdminDetail } from "@/server/modules/assets/admin";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader, StatusBadge } from "@/components/admin/kit";
import { DownloadAssetButton } from "@/components/admin/artwork/DownloadAssetButton";
import { RestoreVersionButton } from "@/components/admin/artwork/RestoreVersionButton";
import { formatBytes } from "@/lib/utils";
import { restoreAssetVersionAction } from "../../artworkActions";

export const dynamic = "force-dynamic";

export default async function AssetVersionHistoryPage({ params }: { params: { assetId: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let asset;
  try {
    asset = await getAssetAdminDetail(ctx, params.assetId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const versions = await getAssetVersionHistory(ctx, params.assetId);

  return (
    <div>
      <Link href="/admin/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title={`Version History — ${asset.name}`} description={`${asset.brandName} · ${versions.length} version${versions.length === 1 ? "" : "s"}`} />

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Version</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Size</th>
              <th className="px-4 py-2.5 text-left">Uploaded</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    v{v.version}
                    {v.isCurrent && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">CURRENT</span>}
                  </span>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(v.sizeBytes)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{v.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <DownloadAssetButton assetId={v.id} className="text-primary hover:underline" />
                    {!v.isCurrent && (
                      <RestoreVersionButton assetId={params.assetId} targetVersionId={v.id} action={restoreAssetVersionAction} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
