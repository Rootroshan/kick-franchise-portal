import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Store, Users, ShoppingCart, DollarSign, Package, MapPin, Phone, Mail, Globe } from "lucide-react";
import { parseTenantTheme } from "@/lib/theme";
import { EditBrandDialog } from "@/components/admin/EditBrandDialog";
import { requireRole } from "@/server/modules/identity/guard";
import { getBrandBySlug } from "@/server/modules/tenants/brands";
import { listLocations, listCustomDomains, listMemberships } from "@/server/modules/tenants/service";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge } from "@/components/admin/kit";
import { LocationsPanel } from "@/components/admin/LocationsPanel";
import { DomainsPanel } from "@/components/admin/DomainsPanel";
import { MembersPanel } from "@/components/admin/MembersPanel";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({ params }: { params: { slug: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();

  let brand;
  try {
    brand = await getBrandBySlug(ctx, params.slug);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }

  // Interactive panels manage their own add-forms; feed them the initial rows.
  const [locations, domains, members] = await Promise.all([
    listLocations(ctx, brand.id),
    listCustomDomains(ctx, brand.id),
    listMemberships(ctx, brand.id),
  ]);

  return (
    <div>
      <Link href="/admin/brands" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Brands
      </Link>

      <PageHeader
        title={brand.name}
        description={`${brand.slug} · created ${brand.createdAt.toLocaleDateString()}`}
        secondaryAction={<StatusBadge status={brand.status} />}
        action={
          <EditBrandDialog
            brand={{
              id: brand.id,
              name: brand.name,
              status: brand.status,
              hqAddress: brand.hqAddress,
              phone: brand.phone,
              email: brand.email,
              website: brand.website,
              logoUrl: parseTenantTheme(brand.theme).logoUrl,
            }}
          />
        }
      />

      {/* Brand contact details. Shown above the rollups because this is the
          identifying information an operator looks for first. */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Brand information</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoField icon={MapPin} label="Headquarters" value={brand.hqAddress} />
          <InfoField icon={Phone} label="Main phone" value={brand.phone} />
          <InfoField icon={Mail} label="Main email" value={brand.email} />
          <InfoField icon={Globe} label="Website" value={brand.website} href={brand.website} />
        </dl>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPIStatCard label="Stores" value={brand.stores.length} icon={Store} tone="info" />
        <KPIStatCard label="Members" value={brand.members.length} icon={Users} tone="purple" />
        <KPIStatCard label="Orders" value={brand.orderCount} icon={ShoppingCart} tone="warning" />
        <KPIStatCard label="Products" value={brand.productCount} icon={Package} tone="teal" />
        <KPIStatCard label="Revenue" value={formatCents(brand.revenueCents)} icon={DollarSign} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Stores</h2>
            <LocationsPanel tenantId={brand.id} initialLocations={locations} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Members</h2>
            <MembersPanel tenantId={brand.id} initialMembers={members} />
          </div>
        </section>

        <section>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Custom Domains</h2>
            <DomainsPanel tenantId={brand.id} initialDomains={domains} />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Theme</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <ThemeRow label="Primary" value={brand.theme.primary as string | undefined} swatch />
            <ThemeRow label="Secondary" value={brand.theme.secondary as string | undefined} swatch />
            <ThemeRow label="Font" value={brand.theme.font as string | undefined} />
            <ThemeRow label="Logo" value={brand.theme.logoUrl ? "Set" : "Not set"} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeRow({ label, value, swatch }: { label: string; value?: string; swatch?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        {swatch && value && <span className="h-4 w-4 rounded-full border border-border" style={{ background: value }} />}
        {value || "—"}
      </span>
    </div>
  );
}

/** One brand contact field. Renders an em dash when unset, never a blank gap. */
function InfoField({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  href?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground">
          {value ? (
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-status-info hover:underline">
                {value}
              </a>
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </dd>
      </div>
    </div>
  );
}
