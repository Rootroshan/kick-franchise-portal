import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Store, Users, ShoppingCart, DollarSign, Package, MapPin, Phone, Mail, Globe, User as UserIcon } from "lucide-react";
import { parseTenantTheme } from "@/lib/theme";
import { EditBrandDialog } from "@/components/admin/EditBrandDialog";
import { requireRole } from "@/server/modules/identity/guard";
import { getBrandBySlug } from "@/server/modules/tenants/brands";
import { listCustomDomains } from "@/server/modules/tenants/service";
import { HttpError } from "@/server/modules/identity/errors";
import { formatCents } from "@/lib/utils";
import { PageHeader, KPIStatCard, StatusBadge } from "@/components/admin/kit";
import { StoresPanel } from "@/components/admin/StoresPanel";
import { DomainsPanel } from "@/components/admin/DomainsPanel";
import { FranchisorAdminsPanel } from "@/components/admin/FranchisorAdminsPanel";
import { listFranchisorAdmins, listFranchisorAdminInvitations } from "./adminActions";

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
  const [domains, franchisorAdmins, franchisorAdminInvitations] = await Promise.all([
    listCustomDomains(ctx, brand.id),
    listFranchisorAdmins(brand.id),
    listFranchisorAdminInvitations(brand.id),
  ]);

  const theme = parseTenantTheme(brand.theme);
  // A brand's overall domain status is its most-advanced domain, or "Not
  // configured" when none exists yet — matches the badge shown in Brands list.
  const domainStatus = domains.length === 0 ? null : domains.some((d) => d.status === "VERIFIED") ? "VERIFIED" : domains[0]!.status;

  return (
    <div>
      <Link href="/admin/brands" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Brands
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {theme.logoUrl ? (
              <Image
                src={theme.logoUrl}
                alt={`${brand.name} logo`}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-lg border border-border object-contain"
                unoptimized
              />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                style={{ backgroundColor: theme.primary }}
              >
                {brand.name.charAt(0).toUpperCase()}
              </span>
            )}
            {brand.name}
          </span>
        }
        description={`${brand.slug} · Created ${brand.createdAt.toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" })} · ID ${brand.id.slice(0, 8).toUpperCase()}`}
        secondaryAction={
          <div className="flex items-center gap-2">
            <StatusBadge status={brand.status} />
            {domainStatus && <StatusBadge status={domainStatus} />}
          </div>
        }
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
              logoUrl: theme.logoUrl,
            }}
          />
        }
      />

      {/* Brand contact details. Shown above the rollups because this is the
          identifying information an operator looks for first. */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Brand information</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoField icon={UserIcon} label="Franchisor contact" value={brand.contactName} />
          <InfoField icon={Phone} label="Main phone" value={brand.phone} />
          <InfoField icon={Mail} label="Main email" value={brand.email} />
          <InfoField icon={Globe} label="Website" value={brand.website} href={brand.website} />
          <InfoField icon={MapPin} label="Headquarters" value={brand.hqAddress} />
        </dl>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPIStatCard label="Stores" value={brand.stores.length} icon={Store} tone="info" />
        <KPIStatCard label="Members" value={brand.members.length} icon={Users} tone="purple" />
        <KPIStatCard label="Orders" value={brand.orderCount} icon={ShoppingCart} tone="warning" />
        <KPIStatCard label="Products" value={brand.productCount} icon={Package} tone="teal" />
        <KPIStatCard label="Revenue" value={formatCents(brand.revenueCents)} icon={DollarSign} tone="success" />
      </div>

      {/* xl:, not lg: — at 1024-1280px a 2/3 + 1/3 split left the right rail
          (Custom Domains, Theme, Activity) too narrow for its own inputs and
          the left column's Stores table too narrow for its columns. Both
          columns stack full-width until the viewport is wide enough for a
          1/3 rail to actually fit its content. */}
      {/* min-w-0 on the grid/flex chain down to each card: without it, a flex
          or grid item defaults to min-width:auto, so the Stores table's
          intrinsic content width (fixed column widths + padding) pushed this
          whole section — and the grid track containing it — wider than the
          viewport instead of scrolling inside its own overflow-x-auto
          wrapper. Nothing here changes what scrolls, only what's allowed to
          force its container wider. */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
            <StoresPanel tenantId={brand.id} slug={brand.slug} stores={brand.stores} />
          </div>

          {/* Franchisor admins get their own section: creating one here pins
              role and tenant server-side. Franchisee users are deliberately
              NOT manageable from here — they belong to one store, so they are
              only ever added from that store's own detail page. */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4">
            <FranchisorAdminsPanel
              tenantId={brand.id}
              slug={brand.slug}
              admins={franchisorAdmins}
              invitations={franchisorAdminInvitations}
            />
          </div>
        </section>

        <section>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Custom Domains</h2>
            <DomainsPanel tenantId={brand.id} initialDomains={domains} />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Theme &amp; Branding</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
            <ThemeRow label="Primary Color" value={brand.theme.primary as string | undefined} swatch />
            <ThemeRow label="Secondary Color" value={brand.theme.secondary as string | undefined} swatch />
            <ThemeRow label="Font Family" value={brand.theme.font as string | undefined} />
            <ThemeRow label="Logo" value={logoFilename(brand.theme.logoUrl as string | undefined)} />
          </div>

          {/* Brand-scoped audit trail. Sourced from AuditLog, which is already
              tenant-scoped by RLS — no separate activity table to drift. */}
          <h2 className="mb-2 mt-6 text-sm font-semibold">Recent Activity</h2>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            {brand.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {brand.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-info" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{describeAudit(a.action, a.entity)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("en-CA", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/audit-log" className="mt-3 inline-block text-xs font-medium text-status-info hover:underline">
              View all activity →
            </Link>
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
  // Defence in depth: the schema rejects non-http(s) schemes on write, but rows
  // stored before that check exist and would still render javascript: as a
  // clickable href. Anything not http(s) degrades to plain text.
  const safeHref = href && /^https?:\/\//i.test(href) ? href : undefined;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground">
          {value ? (
            safeHref ? (
              <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-status-info hover:underline">
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

/** Filename from a logo URL, so the panel shows "logo.png" not a long URL. */
function logoFilename(url?: string): string {
  if (!url) return "Not set";
  try {
    return new URL(url).pathname.split("/").pop() || "Set";
  } catch {
    return "Set";
  }
}

/** Human phrasing for an audit row: "product.update on Product" reads poorly. */
function describeAudit(action: string, entity: string): string {
  const verb = action.split(".").pop() ?? action;
  const past: Record<string, string> = {
    create: "created", update: "updated", delete: "deleted",
    verify: "verified", remove: "removed", activate: "activated",
    deactivate: "deactivated", status_change: "status changed",
    access_change: "access changed", password_reset: "password reset",
  };
  return `${entity} ${past[verb] ?? verb}`;
}
