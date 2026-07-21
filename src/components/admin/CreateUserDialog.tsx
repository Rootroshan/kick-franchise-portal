"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Loader2, X, AlertCircle } from "lucide-react";
import { createUserAction } from "@/app/admin/users/actions";

type Option = { value: string; label: string };

/**
 * Create User dialog.
 *
 * Client-side checks are for fast feedback only — the server action re-validates
 * everything (email format, password match and strength, duplicate email, role
 * validity) because these inputs cross a trust boundary.
 */
export function CreateUserDialog({ brandOptions }: { brandOptions: Option[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "FRANCHISEE_USER",
    isActive: true,
    tenantId: "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createUserAction(form);
      if (res.ok) {
        setOpen(false);
        setForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role: "FRANCHISEE_USER",
          isActive: true,
          tenantId: "",
        });
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
        Create User
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md scrollbar-hide overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">Create user</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
              <Labelled label="Full name">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} disabled={pending} required />
              </Labelled>
              <Labelled label="Email">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} disabled={pending} required autoComplete="off" />
              </Labelled>
              <Labelled label="Phone (optional)">
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} disabled={pending} />
              </Labelled>

              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Password">
                  <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputCls} disabled={pending} required autoComplete="new-password" />
                </Labelled>
                <Labelled label="Confirm">
                  <input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} className={inputCls} disabled={pending} required autoComplete="new-password" />
                </Labelled>
              </div>

              <Labelled label="Role">
                <select value={form.role} onChange={(e) => set("role", e.target.value)} className={inputCls} disabled={pending}>
                  <option value="KICK_ADMIN">Super Admin</option>
                  <option value="FRANCHISOR_ADMIN">Franchisor Admin</option>
                </select>
              </Labelled>
              {/* Franchisee (store-level) users are deliberately not creatable
                  here — a FRANCHISEE_USER account requires a specific store
                  assignment, and this dialog has no store context. They are
                  only ever created from that store's own detail page
                  (Brands → Brand → Stores → Store → Team → Add User). */}
              <p className="-mt-1 text-xs text-muted-foreground">
                To create a franchisee (store-level) user, open their store&rsquo;s page and add them under Team.
              </p>

              {form.role !== "KICK_ADMIN" && (
                <Labelled label="Brand access">
                  <select value={form.tenantId} onChange={(e) => set("tenantId", e.target.value)} className={inputCls} disabled={pending}>
                    <option value="">Select a brand…</option>
                    {brandOptions.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </Labelled>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 rounded border-border accent-status-info" disabled={pending} />
                Active — can sign in immediately
              </label>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create user
              </button>
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

const inputCls = "min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal disabled:opacity-60";
