"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Loader2, X, AlertCircle } from "lucide-react";
import { createProductAction, createVariantAction } from "@/app/admin/commerce/actions";

type Option = { value: string; label: string };

/**
 * Create Product / Add Variant dialogs.
 *
 * The commerce API and services already existed with validation, audit logging
 * and KICK_ADMIN guards — only the UI was missing, so these are deliberately
 * thin.
 *
 * Prices are entered in dollars for usability but converted to integer cents
 * before submitting. Money never travels or persists as a float.
 */
export function CreateProductDialog({ brandOptions }: { brandOptions: Option[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ tenantId: "", name: "", sku: "", active: true });

  useEscapeToClose(open, () => setOpen(false));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createProductAction(form);
      if (res.ok) {
        setOpen(false);
        setForm({ tenantId: "", name: "", sku: "", active: true });
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-status-info px-4 text-sm font-semibold text-white hover:opacity-95"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New Product
      </button>

      {open && (
        <Modal title="New product" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <Labelled label="Brand">
              <select
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                className={inputCls}
                disabled={pending}
                required
              >
                <option value="">Select a brand…</option>
                {brandOptions.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Product name">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                disabled={pending}
                required
              />
            </Labelled>

            <Labelled label="SKU">
              <input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className={inputCls}
                disabled={pending}
                required
              />
            </Labelled>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                disabled={pending}
                className="h-4 w-4 rounded border-border accent-status-info"
              />
              Active — available to order
            </label>

            <ErrorBanner message={error} />

            <p className="text-xs text-muted-foreground">
              Add pricing by creating a variant once the product exists. A product with no active variant cannot be
              ordered.
            </p>

            <SubmitButton pending={pending} label="Create product" />
          </form>
        </Modal>
      )}
    </>
  );
}

export function AddVariantDialog({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", price: "", stock: "", active: true });

  useEscapeToClose(open, () => setOpen(false));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid price.");

    startTransition(async () => {
      const res = await createVariantAction({
        productId,
        name: form.name,
        // Dollars → integer cents at the boundary. Math.round avoids the
        // floating-point drift that would make 19.99 arrive as 1998.
        priceCents: Math.round(price * 100),
        currency: "CAD",
        stock: form.stock.trim() === "" ? null : Number(form.stock),
        active: form.active,
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", price: "", stock: "", active: true });
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add variant
      </button>

      {open && (
        <Modal title={`Add variant — ${productName}`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <Labelled label="Variant name">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                disabled={pending}
                placeholder="e.g. 12oz, Large, Blue"
                required
              />
            </Labelled>

            <div className="grid grid-cols-2 gap-3">
              <Labelled label="Price (CAD)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                  required
                />
              </Labelled>
              <Labelled label="Stock (optional)">
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className={inputCls}
                  disabled={pending}
                  placeholder="Untracked"
                />
              </Labelled>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                disabled={pending}
                className="h-4 w-4 rounded border-border accent-status-info"
              />
              Active
            </label>

            <ErrorBanner message={error} />
            <SubmitButton pending={pending} label="Add variant" />
          </form>
        </Modal>
      )}
    </>
  );
}

function useEscapeToClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md scrollbar-hide overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
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
