import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getAssetAdminDetail } from "@/server/modules/assets/admin";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";
import { UploadArtworkForm } from "@/components/admin/artwork/UploadArtworkForm";

export const dynamic = "force-dynamic";

export default async function ReplaceArtworkPage({ params }: { params: { assetId: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let asset;
  try {
    asset = await getAssetAdminDetail(ctx, params.assetId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="max-w-xl">
      <Link href="/admin/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title={`Replace "${asset.name}"`} description={`Uploading a new version will supersede v${asset.version}. The previous version is preserved and archived.`} />
      <UploadArtworkForm
        returnTo="/admin/artwork"
        fixedTenantId={asset.tenantId}
        replaces={{ id: asset.id, name: asset.name, category: asset.category, type: asset.type }}
      />
    </div>
  );
}
