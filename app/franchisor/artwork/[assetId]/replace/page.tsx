import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorAsset } from "@/server/modules/assets/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { PageHeader } from "@/components/admin/kit";
import { UploadArtworkForm } from "@/components/admin/artwork/UploadArtworkForm";

export const dynamic = "force-dynamic";

export default async function ReplaceArtworkPage({ params }: { params: { assetId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let asset;
  try {
    asset = await getFranchisorAsset(ctx, ctx.tenantId, params.assetId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="max-w-xl">
      <Link href="/franchisor/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title={`Replace "${asset.name}"`} description={`Uploading a new version will supersede v${asset.version}. The previous version is preserved and archived.`} />
      <UploadArtworkForm
        returnTo="/franchisor/artwork"
        replaces={{ id: asset.id, name: asset.name, category: asset.category, type: asset.type }}
      />
    </div>
  );
}
