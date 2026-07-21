import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getBrandUploadTargets } from "@/server/modules/assets/admin";
import { PageHeader } from "@/components/admin/kit";
import { UploadArtworkForm } from "@/components/admin/artwork/UploadArtworkForm";

export const dynamic = "force-dynamic";

export default async function ArtworkUploadPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const brandOptions = await getBrandUploadTargets(ctx);

  return (
    <div className="max-w-xl">
      <Link href="/admin/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title="Upload Artwork" description="Add a new brand asset — logo, signage, menu board, campaign, or template." />
      <UploadArtworkForm returnTo="/admin/artwork" brandOptions={brandOptions} />
    </div>
  );
}
