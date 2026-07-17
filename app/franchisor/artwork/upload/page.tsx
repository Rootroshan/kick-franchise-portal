import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { PageHeader } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

/**
 * Artwork uploads are centrally controlled by Kick (see the [K]-gated
 * /api/assets/upload-url + /api/assets routes). Franchisors preview and
 * download; they do not upload. This page states that clearly rather than
 * presenting a control that would 403. Flip this to a franchisor upload flow
 * by relaxing those routes to [K,F] — see README "Implementation Assumptions".
 */
export default async function ArtworkUploadPage() {
  await requireTenantRole("FRANCHISOR_ADMIN")();

  return (
    <div className="max-w-xl">
      <Link href="/franchisor/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>
      <PageHeader title="Upload Artwork" description="Adding new brand assets." />

      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="mb-2 font-medium text-foreground">Artwork is managed by Kick Media.</p>
          <p className="text-muted-foreground">
            To keep brand assets consistent and versioned across every store, uploads and version replacements are handled centrally
            by the Kick Media team. Contact your Kick account manager to add or update artwork. You can preview and download all
            active assets from the Artwork Hub at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
