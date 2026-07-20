"use client";

import { useState, useTransition, useEffect } from "react";
import { Pencil, Loader2, X, AlertCircle } from "lucide-react";
import { updateBrandAction } from "@/app/admin/brands/actions";

export type BrandFormValues = {
  id: string;
  name: string;
  status: string;
  hqAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string;
};

/**
 * Edit Brand Details.
 *
 * Fields are prefilled from the current record so the form shows what is
 * actually stored. Empty strings are submitted deliberately — the server maps
 * them to NULL, which is how a value gets cleared. Sending undefined instead
 * would silently keep the old value.
 */
export function EditBrandDialog({ brand }: { brand: BrandFormValues }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: brand.name,
    status: brand.status,
    hqAddress: brand.hqAddress ?? "",
    phone: brand.phone ?? "",
    email: brand.email ?? "",
    website: brand.website ?? "",
    logoUrl: brand.logoUrl,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateBrandAction(brand.id, {
        name: form.name,
        status: form.status,
        hqAddress: form.hqAddress,
        phone: form.phone,
        email: form.email,
        website: form.website,
        // Only send theme when a logo is present: an empty string would fail
        // the schema's url() check.
        ...(form.logoUrl ? { theme: { logoUrl: form.logoUrl } } : {}),
      });
      if (res.ok) setOpen(false);
      else setError(res.message);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit Brand Details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">Edit brand details</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
              <Labelled label="Brand name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                  required
                />
              </Labelled>

              <Labelled label="Logo URL">
                <input
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                  placeholder="https://…"
                />
              </Labelled>

              <Labelled label="Headquarters address">
                <textarea
                  value={form.hqAddress}
                  onChange={(e) => setForm((f) => ({ ...f, hqAddress: e.target.value }))}
                  className={`${inputCls} min-h-20 py-2`}
                  disabled={pending}
                  rows={2}
                />
              </Labelled>

              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled label="Main phone">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                    disabled={pending}
                  />
                </Labelled>
                <Labelled label="Main email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                    disabled={pending}
                  />
                </Labelled>
              </div>

              <Labelled label="Website">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                  placeholder="https://…"
                />
              </Labelled>

              <Labelled label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Labelled>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const inputCls =
  "min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal disabled:opacity-60";
