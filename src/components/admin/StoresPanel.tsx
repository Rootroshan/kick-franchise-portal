"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  useListNavigation,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Store as StoreIcon,
} from "lucide-react";
import { createStoreAction, updateStoreAction, deleteStoreAction } from "@/app/admin/brands/[slug]/storeActions";
import { cn } from "@/lib/utils";

export type StoreRow = {
  id: string;
  name: string;
  storeCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  managerName: string | null;
  managerEmail: string | null;
  memberCount: number;
};

const PAGE_SIZE = 5;

/**
 * Stores for one brand.
 *
 * Search, status filter and paging are client-side: a brand's store count is
 * small and already fetched with the page, so a round trip per keystroke would
 * be slower and would lose the rest of the page's state.
 */
export function StoresPanel({ tenantId, slug, stores }: { tenantId: string; slug: string; stores: StoreRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ kind: "create" | "edit" | "delete"; store?: StoreRow } | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (status && s.status !== status) return false;
      if (!q) return true;
      return [s.name, s.address, s.managerName, s.managerEmail].some((v) => v?.toLowerCase().includes(q));
    });
  }, [stores, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const res = await fn();
      setBanner(res);
      if (res.ok) {
        setDialog(null);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Stores</h2>
        <button
          onClick={() => setDialog({ kind: "create" })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-status-info px-3 text-xs font-semibold text-white hover:opacity-95"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Store
        </button>
      </div>

      {banner && (
        <div
          role="status"
          className={cn(
            "mb-3 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm",
            banner.ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
          )}
        >
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, address or manager…"
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">Status: All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <StoreIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No stores found</p>
          <p className="text-xs text-muted-foreground">
            {search || status ? "Try different filters." : "Add a store to get started."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden scrollbar-hide overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-foreground/70">
                  <th className="w-48 px-3 py-2">Store name</th>
                  <th className="w-56 px-3 py-2">Address</th>
                  <th className="w-40 px-3 py-2">Manager</th>
                  <th className="w-32 px-3 py-2">Phone</th>
                  <th className="w-20 px-3 py-2 text-right">Members</th>
                  <th className="w-24 px-3 py-2">Status</th>
                  <th className="w-32 whitespace-nowrap px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="max-w-48 truncate px-3 py-2 font-medium text-foreground" title={s.name}>
                      {s.name}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-xs text-muted-foreground" title={s.address ?? undefined}>
                      {s.address ?? "—"}
                    </td>
                    <td className="max-w-40 px-3 py-2">
                      <div className="truncate text-xs text-foreground" title={s.managerName ?? undefined}>
                        {s.managerName ?? "—"}
                      </div>
                      {s.managerEmail && (
                        <div className="truncate text-xs text-muted-foreground" title={s.managerEmail}>
                          {s.managerEmail}
                        </div>
                      )}
                    </td>
                    <td className="max-w-32 truncate px-3 py-2 text-xs text-muted-foreground" title={s.phone ?? undefined}>
                      {s.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{s.memberCount}</td>
                    <td className="px-3 py-2">
                      <StoreStatus status={s.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/stores/${s.id}`}
                          className="inline-flex min-h-8 items-center rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-muted"
                        >
                          View
                        </Link>
                        <StoreRowMenu
                          store={s}
                          slug={slug}
                          onEdit={() => setDialog({ kind: "edit", store: s })}
                          onDelete={() => setDialog({ kind: "delete", store: s })}
                          onToggle={() =>
                            run(() =>
                              updateStoreAction(s.id, slug, { status: s.status === "active" ? "inactive" : "active" })
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {visible.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.address ?? "—"}</div>
                  </div>
                  <StoreStatus status={s.status} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {s.managerName ?? "No manager"} · {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={`/admin/stores/${s.id}`}
                    className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-border text-xs font-semibold hover:bg-muted"
                  >
                    View
                  </Link>
                  <StoreRowMenu
                    store={s}
                    slug={slug}
                    onEdit={() => setDialog({ kind: "edit", store: s })}
                    onDelete={() => setDialog({ kind: "delete", store: s })}
                    onToggle={() =>
                      run(() => updateStoreAction(s.id, slug, { status: s.status === "active" ? "inactive" : "active" }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {visible.length} of {filtered.length} store{filtered.length === 1 ? "" : "s"}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="min-h-8 rounded-md border border-border px-2 text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-1 text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="min-h-8 rounded-md border border-border px-2 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {dialog?.kind === "create" && (
        <StoreForm
          title="Add store"
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(data) => run(() => createStoreAction(tenantId, slug, data))}
        />
      )}

      {dialog?.kind === "edit" && dialog.store && (
        <StoreForm
          title={`Edit ${dialog.store.name}`}
          store={dialog.store}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(data) => run(() => updateStoreAction(dialog.store!.id, slug, data))}
        />
      )}

      {dialog?.kind === "delete" && dialog.store && (
        <Modal title={`Delete ${dialog.store.name}?`} onClose={() => setDialog(null)}>
          <div className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This permanently removes the store, along with any orders and allowances tied to it. Members lose their
              assignment to this store but keep their account. This cannot be undone.
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setDialog(null)} disabled={pending} className={secondaryBtn}>
              Cancel
            </button>
            <button
              onClick={() => run(() => deleteStoreAction(dialog.store!.id, slug))}
              disabled={pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete store
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Portalled so the menu is never clipped by the table's overflow container. */
function StoreRowMenu({
  store,
  onEdit,
  onDelete,
  onToggle,
}: {
  store: StoreRow;
  slug: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const listNav = useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, role, listNav]);

  const active = store.status === "active";
  const items = [
    { icon: Eye, label: "View Store", href: `/admin/stores/${store.id}`, onClick: undefined },
    { icon: Pencil, label: "Edit Store", onClick: onEdit },
    { icon: active ? PauseCircle : PlayCircle, label: active ? "Deactivate" : "Activate", onClick: onToggle },
    { icon: Trash2, label: "Delete Store", onClick: onDelete, destructive: true },
  ];

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({ onClick: (e) => { e.stopPropagation(); setOpen(!open); } })}
        className="rounded-md border border-border p-1.5 hover:bg-muted"
        aria-label={`Actions for ${store.name}`}
        aria-expanded={open}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-50 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              {items.map((item, i) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => setOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    ref={(node) => {
                      listRef.current[i] = node;
                    }}
                    role="menuitem"
                    tabIndex={activeIndex === i ? 0 : -1}
                    {...getItemProps({
                      onClick: (e) => {
                        e.stopPropagation();
                        setOpen(false);
                        item.onClick?.();
                      },
                    })}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted",
                      activeIndex === i && "bg-muted",
                      item.destructive && "border-t border-border text-status-error"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                )
              )}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * Store fields not carried by StoreRow (the list-display shape) but required
 * to create/edit one — structured address and manager phone are write-only
 * from this form's perspective; StoreRow only needs what the table displays.
 */
type StoreFormExtra = {
  storeCode: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
};

function StoreForm({
  title,
  store,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  store?: StoreRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: store?.name ?? "",
    storeCode: store?.storeCode ?? "",
    addressLine1: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    addressCountry: "",
    phone: store?.phone ?? "",
    email: store?.email ?? "",
    managerName: store?.managerName ?? "",
    managerEmail: store?.managerEmail ?? "",
    managerPhone: "",
    status: store?.status ?? "active",
  } satisfies { name: string; phone: string; email: string; status: string } & StoreFormExtra);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={title} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Store name" required>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="Store number / code" required>
            <input value={form.storeCode} onChange={(e) => set("storeCode", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
        </div>

        <Labelled label="Street address" required>
          <input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={inputCls} disabled={pending} required />
        </Labelled>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label="City" required>
            <input value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="State / Province" required>
            <input value={form.addressState} onChange={(e) => set("addressState", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Postal code" required>
            <input value={form.addressPostalCode} onChange={(e) => set("addressPostalCode", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="Country" required>
            <input value={form.addressCountry} onChange={(e) => set("addressCountry", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Store phone" required>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="Store email" required>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
        </div>

        <div className="mt-1 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Store manager / main contact</p>
          <div className="flex flex-col gap-3">
            <Labelled label="Manager name" required>
              <input value={form.managerName} onChange={(e) => set("managerName", e.target.value)} className={inputCls} disabled={pending} required />
            </Labelled>
            <div className="grid grid-cols-2 gap-3">
              <Labelled label="Manager email" required>
                <input type="email" value={form.managerEmail} onChange={(e) => set("managerEmail", e.target.value)} className={inputCls} disabled={pending} required />
              </Labelled>
              <Labelled label="Manager phone" required>
                <input type="tel" value={form.managerPhone} onChange={(e) => set("managerPhone", e.target.value)} className={inputCls} disabled={pending} required />
              </Labelled>
            </div>
          </div>
        </div>

        <Labelled label="Status">
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} disabled={pending}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Labelled>

        <div className="mt-1 flex gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className={secondaryBtn}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StoreStatus({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        active ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <FloatingPortal>
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
    </FloatingPortal>
  );
}

function Labelled({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required && <span className="text-status-error"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal disabled:opacity-60";
const secondaryBtn = "min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60";
