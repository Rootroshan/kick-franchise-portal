"use client";

import { useState, useTransition, useRef, useEffect } from "react";
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
  MoreVertical,
  Eye,
  Pencil,
  Globe,
  PauseCircle,
  PlayCircle,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { deleteBrandAction, setBrandStatusAction, getBrandBlockersAction } from "@/app/admin/brands/actions";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { BrandRow } from "@/server/modules/tenants/brands";

type Pick_ = "view" | "edit" | "domain" | "toggle" | "delete";

/**
 * Brand row actions.
 *
 * Portalled to document.body and positioned with Floating UI so the menu is
 * never clipped by the table's overflow container and flips above the trigger
 * on the last rows — the same fix applied to the Users table.
 */
export function BrandRowMenu({ brand }: { brand: BrandRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"delete" | "toggle" | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [, startTransition] = useTransition();

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

  const suspended = brand.status !== "active";

  const items: Array<{ icon: typeof Eye; label: string; kind: Pick_; destructive?: boolean }> = [
    { icon: Eye, label: "View Details", kind: "view" },
    { icon: Pencil, label: "Edit Brand", kind: "edit" },
    { icon: Globe, label: "Manage Domain", kind: "domain" },
    {
      icon: suspended ? PlayCircle : PauseCircle,
      label: suspended ? "Activate Brand" : "Deactivate Brand",
      kind: "toggle",
    },
    { icon: Trash2, label: "Delete Brand", kind: "delete", destructive: true },
  ];

  const onPick = (kind: Pick_) => {
    setOpen(false);
    switch (kind) {
      case "view":
        router.push(`/admin/brands/${brand.id}`);
        break;
      case "edit":
        // Edit lives on the detail page, where the full form and its
        // prefilled values already exist.
        router.push(`/admin/brands/${brand.id}#edit`);
        break;
      case "domain":
        router.push(`/admin/brands/${brand.id}#domains`);
        break;
      default:
        setDialog(kind === "delete" ? "delete" : "toggle");
    }
  };

  const run = (fn: () => Promise<{ ok: boolean; message: string }>, dialogMessage: string) => {
    setActionLoading({ loading: true, message: dialogMessage });
    startTransition(async () => {
      let res: { ok: boolean; message: string };
      try {
        res = await Promise.race([
          fn(),
          new Promise<{ ok: boolean; message: string }>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out after 30 seconds. Please try again.")), 30_000)
          ),
        ]);
      } catch (err) {
        res = { ok: false, message: err instanceof Error ? err.message : "Action failed. Please try again." };
      }
      setActionLoading({ loading: false, message: null });
      setBanner(res);
      if (res.ok) {
        setDialog(null);
        router.refresh(); // refresh the row and KPIs, keeping filters in the URL
      }
    });
  };

  // Shared action loading overlay state
  const [actionLoading, setActionLoading] = useState<{ loading: boolean; message: string | null }>({
    loading: false,
    message: null,
  });

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: (e) => {
            e.stopPropagation();
            setOpen(!open);
          },
        })}
        className="rounded-md border border-border p-2 hover:bg-muted"
        aria-label={`Actions for ${brand.name}`}
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-50 w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              {items.map((item, i) => (
                <button
                  key={item.kind}
                  ref={(node) => {
                    listRef.current[i] = node;
                  }}
                  role="menuitem"
                  tabIndex={activeIndex === i ? 0 : -1}
                  {...getItemProps({
                    onClick: (e) => {
                      e.stopPropagation();
                      onPick(item.kind);
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
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}

      {banner && (
        <FloatingPortal>
          <div
            role="status"
            className={cn(
              "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg",
              banner.ok ? "bg-status-success text-white" : "bg-status-error text-white"
            )}
          >
            {banner.message}
            <button onClick={() => setBanner(null)} aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </FloatingPortal>
      )}

      {dialog === "toggle" && (
        <Modal title={suspended ? `Activate ${brand.name}?` : `Deactivate ${brand.name}?`} onClose={() => { if (!actionLoading.loading) setDialog(null); }}>
          <p className="text-sm text-muted-foreground">
            {suspended
              ? "The brand's portal will accept logins again. All historical data is unchanged."
              : "Users of this brand will be blocked from signing in and no new activity can be recorded. Every store, order and report is preserved, and you can reactivate at any time."}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setDialog(null)} disabled={actionLoading.loading} className={secondaryBtn}>
              Cancel
            </button>
            <button
              onClick={() => run(
                () => setBrandStatusAction(brand.id, suspended ? "active" : "suspended"),
                suspended ? "Activating brand…" : "Deactivating brand…"
              )}
              disabled={actionLoading.loading}
              className={cn(
                "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60",
                suspended ? "bg-status-success" : "bg-status-warning"
              )}
            >
              {actionLoading.loading ? null : (suspended ? "Activate" : "Deactivate")}
              {actionLoading.loading && <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{actionLoading.message}</span>}
            </button>
          </div>
        </Modal>
      )}

      {dialog === "delete" && (
        <DeleteBrandDialog brand={brand} pending={actionLoading.loading} onCancel={() => setDialog(null)} onConfirm={(typed) => run(
          () => deleteBrandAction(brand.id, typed),
          "Deleting brand…"
        )} />
      )}

      {actionLoading.loading && (
        <LoadingOverlay message={actionLoading.message ?? "Processing…"} />
      )}
    </>
  );
}

/**
 * Destructive confirmation.
 *
 * Requires the exact brand name to be typed. That is a speed bump against a
 * mis-click, not a security control — the server independently re-checks the
 * name and refuses when related records exist.
 *
 * The modal opens INSTANTLY with the confirm field ready; the actual blocker
 * list (stores/members/orders/allowance ledger/rebate accruals/verified
 * domains) loads in the background via getBrandBlockersAction — the same
 * check deleteBrand() itself runs, so the warning shown here can never drift
 * from what the server will actually enforce.
 */
function DeleteBrandDialog({
  brand,
  pending,
  onCancel,
  onConfirm,
}: {
  brand: BrandRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [blockers, setBlockers] = useState<{ kind: string; count: number; label: string }[] | null>(null);
  const matches = typed.trim() === brand.name;

  useEffect(() => {
    let cancelled = false;
    getBrandBlockersAction(brand.id)
      .then((rows) => {
        if (!cancelled) setBlockers(rows);
      })
      .catch(() => {
        if (!cancelled) setBlockers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  return (
    <Modal title="Delete Brand" onClose={onCancel} destructive>
      <p className="text-sm text-muted-foreground">This action cannot be undone. Please review the details below.</p>

      <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-error/15">
            <Trash2 className="h-4 w-4 text-status-error" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">You are about to delete the brand:</p>
            <p className="truncate font-semibold text-foreground">{brand.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {brand.customDomain ?? "Domain pending"}
            </p>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-right text-xs">
            <dt className="text-muted-foreground">Stores</dt>
            <dd className="font-semibold tabular-nums text-foreground">{brand.storeCount}</dd>
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-semibold tabular-nums text-foreground">{brand.memberCount}</dd>
            <dt className="text-muted-foreground">Orders</dt>
            <dd className="font-semibold tabular-nums text-foreground">{brand.orderCount}</dd>
            <dt className="text-muted-foreground">Revenue</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatCents(brand.revenueCents)}</dd>
          </dl>
        </div>
      </div>

      {blockers === null ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking for related records…
        </div>
      ) : blockers.length > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            This brand still has {blockers.map((b) => `${b.count} ${b.label}${b.count === 1 ? "" : "s"}`).join(", ")}.
            Permanent deletion will be refused — deactivate it instead to preserve its history.
          </span>
        </div>
      ) : null}

      <label className="mt-4 block text-sm">
        To confirm, type the brand name <strong className="text-foreground">&ldquo;{brand.name}&rdquo;</strong> in the
        field below.
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={pending}
          placeholder="Type brand name to confirm"
          className="mt-2 min-h-10 w-full rounded-md border border-status-error/40 bg-background px-3 text-sm"
          autoComplete="off"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} disabled={pending} className={secondaryBtn}>
          Cancel
        </button>
        <button
          onClick={() => onConfirm(typed)}
          disabled={pending || !matches}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
        >
          {pending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
          ) : (
            <><Trash2 className="h-4 w-4" /> Delete Brand</>
          )}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  destructive,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  destructive?: boolean;
}) {
  return (
    <FloatingPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
        <div className="max-h-[90vh] w-full max-w-lg scrollbar-hide overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h2 className={cn("text-base font-semibold", destructive && "text-status-error")}>{title}</h2>
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

const secondaryBtn =
  "min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60";
