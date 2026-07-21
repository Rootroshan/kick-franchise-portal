import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileImage } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getFranchisorAsset } from "@/server/modules/assets/franchisorList";
import { HttpError } from "@/server/modules/identity/errors";
import { formatBytes } from "@/lib/utils";
import { PageHeader, StatusBadge } from "@/components/admin/kit";
import { DownloadAssetButton } from "@/components/admin/artwork/DownloadAssetButton";
import { ArtworkRowMenu } from "@/components/admin/artwork/ArtworkRowMenu";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: { assetId: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();

  let a;
  try {
    a = await getFranchisorAsset(ctx, ctx.tenantId, params.assetId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/franchisor/artwork" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Artwork Hub
      </Link>

      <PageHeader
        title={a.name}
        description={`${a.category ?? "Other"} · uploaded ${a.createdAt.toLocaleDateString()}`}
        secondaryAction={
          <div className="flex items-center gap-2">
            <StatusBadge status={a.status} />
            <ArtworkRowMenu asset={a} basePath="/franchisor/artwork" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted">
            <FileImage className="h-16 w-16 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <DownloadAssetButton
            assetId={a.id}
            className="justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">File Details</h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Type" value={a.type} />
              <Row label="Category" value={a.category ?? "Other"} />
              <Row label="Format" value={a.mime} />
              <Row label="Size" value={formatBytes(a.sizeBytes)} />
              <Row label="Version" value={`v${a.version}`} />
              <Row label="Status" value={a.status} />
              <Row label="Uploaded By" value={a.uploaderName ?? "—"} />
            </dl>
          </div>

          <p className="text-xs text-muted-foreground">
            Downloads use a secure link that expires within 5 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
