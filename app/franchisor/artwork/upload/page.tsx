import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { PageHeader } from "@/components/admin/kit";
import { UploadArtworkForm } from "@/components/admin/artwork/UploadArtworkForm";

export const dynamic = "force-dynamic";

export default async function ArtworkUploadPage() {
  await requireTenantRole("FRANCHISOR_ADMIN")();

  return (
    <div className="max-w-xl">
      <Link href="/franchisor/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title="Upload Artwork" description="Add a new asset for your brand — logo, signage, menu board, campaign, or template." />
      <UploadArtworkForm returnTo="/franchisor/artwork" />
    </div>
  );
}
