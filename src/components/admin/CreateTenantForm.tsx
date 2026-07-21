"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/fetchJson";

/**
 * Create Brand: collects real franchisor information up front rather than
 * just a name+slug — email, phone and headquarters address are required
 * because they are how the franchisor is actually reached, not optional
 * metadata to fill in later. A custom domain can be attached immediately
 * (it goes through the same createCustomDomain flow the Brand Detail page
 * uses, which returns real DNS instructions — never a guessed/fake value).
 */
export function CreateTenantForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    legalName: "",
    contactName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    addressCountry: "",
    website: "",
    logoUrl: "",
    domain: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { tenant } = await fetchJson<{ tenant: { id: string } }>("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          legalName: form.legalName || undefined,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          addressLine1: form.addressLine1,
          addressCity: form.addressCity,
          addressState: form.addressState,
          addressPostalCode: form.addressPostalCode,
          addressCountry: form.addressCountry,
          website: form.website || undefined,
          theme: form.logoUrl ? { logoUrl: form.logoUrl } : undefined,
        }),
      });

      // The domain is optional at creation time — a brand can be created and
      // have its domain attached later from Brand Detail. Failure here must
      // not lose the brand that was just successfully created.
      if (form.domain.trim()) {
        try {
          await fetchJson(`/api/admin/tenants/${tenant.id}/domains`, {
            method: "POST",
            body: JSON.stringify({ hostname: form.domain.trim() }),
          });
        } catch {
          // Surfaced via the redirect target (Brand Detail's Custom Domains
          // panel), which will simply show no domain yet — not a hard failure.
        }
      }

      router.push(`/admin/brands/${form.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Brand name *</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase())}
            required
            placeholder="acme-burgers"
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            maxLength={63}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="legalName">Legal / business name (if different)</Label>
        <Input id="legalName" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} maxLength={200} />
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">Franchisor contact</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactName">Contact name *</Label>
            <Input id="contactName" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} required maxLength={50} />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">Headquarters address</p>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="addressLine1">Street address *</Label>
            <Input id="addressLine1" value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} required maxLength={300} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="addressCity">City *</Label>
              <Input id="addressCity" value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="addressState">State / Province *</Label>
              <Input id="addressState" value={form.addressState} onChange={(e) => set("addressState", e.target.value)} required maxLength={120} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="addressPostalCode">Postal code *</Label>
              <Input id="addressPostalCode" value={form.addressPostalCode} onChange={(e) => set("addressPostalCode", e.target.value)} required maxLength={30} />
            </div>
            <div>
              <Label htmlFor="addressCountry">Country *</Label>
              <Input id="addressCountry" value={form.addressCountry} onChange={(e) => set("addressCountry", e.target.value)} required maxLength={120} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">Branding &amp; portal</p>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="logoUrl">Brand logo URL</Label>
            <Input id="logoUrl" type="url" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.png" />
          </div>
          <div>
            <Label htmlFor="domain">Portal custom domain</Label>
            <Input id="domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="portal.example.com" />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional here — DNS setup instructions appear on the brand&rsquo;s page once created, whether or not you enter
              a domain now.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? "Creating…" : "Create brand"}
      </Button>
    </form>
  );
}
