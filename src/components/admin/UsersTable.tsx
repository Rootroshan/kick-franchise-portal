"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
  UserCircle,
  Pencil,
  KeyRound,
  ShieldCheck,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import type { UserRow } from "@/server/modules/users/service";
import {
  updateUserAction,
  setUserActiveAction,
  resetPasswordAction,
  deleteUserAction,
} from "@/app/admin/users/actions";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * Users table with per-row actions.
 *
 * `currentUserId` comes from the server so the UI can hide self-destructive
 * actions. That is presentation only — the service re-checks the caller id,
 * which is the boundary that actually enforces it.
 */
export function UsersTable({
  rows,
  currentUserId,
  brandOptions,
}: {
  rows: UserRow[];
  currentUserId: string;
  brandOptions: Option[];
}) {
  // Keyed "<layout>:<userId>", not just the user id. The desktop table and the
  // mobile card list are BOTH mounted at all times — Tailwind only toggles
  // their visibility with `hidden`/`md:hidden`, which is display:none, not
  // unmounting. A plain user-id key therefore matched a row in each tree and
  // opened two menus; the hidden one had a display:none trigger, so Floating UI
  // measured a zero rect and parked it in the top-left corner.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: MenuPick; user: UserRow } | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const res = await fn();
      setBanner(res);
      if (res.ok) setDialog(null);
      setOpenMenu(null);
    });
  };

  return (
    <>
      {banner && (
        <div
          role="status"
          className={cn(
            "mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
            banner.ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
          )}
        >
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden scrollbar-hide overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Brand / Store</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name ?? u.email} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      {u.phone && <div className="truncate text-xs text-muted-foreground">{u.phone}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">
                  <div className="text-sm">{u.tenantName ?? "All brands"}</div>
                  <div className="text-xs text-muted-foreground">{u.locationName ?? "—"}</div>
                </td>
                <td className="px-4 py-3"><StatusPill active={u.isActive} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(u.lastLoginAt)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <RowMenu
                    user={u}
                    isSelf={u.id === currentUserId}
                    open={openMenu === `desktop:${u.id}`}
                    onSetOpen={(next) => setOpenMenu(next ? `desktop:${u.id}` : null)}
                    onPick={(kind) => {
                      setOpenMenu(null);
                      // Every action — including status change — goes through a
                      // dialog so nothing destructive happens on a single click.
                      setDialog({ kind, user: u });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — a 7-column table cannot work on a phone. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name ?? u.email} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.name ?? "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <RowMenu
                user={u}
                isSelf={u.id === currentUserId}
                open={openMenu === `mobile:${u.id}`}
                onSetOpen={(next) => setOpenMenu(next ? `mobile:${u.id}` : null)}
                onPick={(kind) => {
                  setOpenMenu(null);
                  if (kind === "toggle") run(() => setUserActiveAction(u.id, !u.isActive));
                  else setDialog({ kind, user: u });
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoleBadge role={u.role} />
              <StatusPill active={u.isActive} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {u.tenantName ?? "All brands"}
              {u.locationName ? ` · ${u.locationName}` : ""} · last login {relativeTime(u.lastLoginAt)}
            </div>
          </div>
        ))}
      </div>

      {dialog && (
        <Dialog onClose={() => setDialog(null)} title={dialogTitle(dialog.kind, dialog.user)}>
          {dialog.kind === "view" && <ViewProfile user={dialog.user} />}
          {(dialog.kind === "edit" || dialog.kind === "access") && (
            <EditForm
              user={dialog.user}
              mode={dialog.kind}
              brandOptions={brandOptions}
              isSelf={dialog.user.id === currentUserId}
              pending={pending}
              onSubmit={(data) => run(() => updateUserAction(dialog.user.id, data))}
            />
          )}
          {dialog.kind === "reset" && (
            <ResetForm
              pending={pending}
              onSubmit={(pw, confirm) => run(() => resetPasswordAction(dialog.user.id, pw, confirm))}
            />
          )}
          {dialog.kind === "toggle" && (
            <ConfirmStatus
              user={dialog.user}
              pending={pending}
              onConfirm={() => run(() => setUserActiveAction(dialog.user.id, !dialog.user.isActive))}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog.kind === "delete" && (
            <ConfirmDelete
              user={dialog.user}
              pending={pending}
              onConfirm={() => run(() => deleteUserAction(dialog.user.id))}
              onCancel={() => setDialog(null)}
            />
          )}
        </Dialog>
      )}
    </>
  );
}

type MenuPick = "view" | "edit" | "access" | "reset" | "delete" | "toggle";

/**
 * Row action menu.
 *
 * Rendered through a portal to document.body: the table is inside an
 * `scrollbar-hide overflow-x-auto` container, which clips any absolutely-positioned child, so
 * a menu on the last row was cut off.
 *
 * Positioning uses Floating UI rather than hand-rolled maths:
 *  - `flip()` opens the menu ABOVE the trigger when there is not enough room
 *    below (the reported bug), and back below when there is.
 *  - `shift()` keeps it inside the viewport horizontally on narrow screens.
 *  - `autoUpdate` re-runs positioning on scroll and resize — it listens on
 *    every scrollable ancestor, so scrolling the table itself is covered too.
 *
 * `useDismiss` handles outside-click and Escape; `useListNavigation` gives
 * arrow-key movement, and FloatingFocusManager traps focus and restores it to
 * the trigger on close.
 */
function RowMenu({
  user,
  isSelf,
  open,
  onSetOpen,
  onPick,
}: {
  user: UserRow;
  isSelf: boolean;
  open: boolean;
  /** Explicit next state, not a toggle — see onOpenChange below. */
  onSetOpen: (next: boolean) => void;
  onPick: (kind: MenuPick) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    // Floating UI already tells us the intended next state. Forwarding it
    // verbatim keeps this idempotent — an earlier version called a blind
    // toggle() here AND from the trigger's onClick, so dismissing one menu to
    // open another fired twice and cancelled itself out.
    onOpenChange: (next) => onSetOpen(next),
    placement: "bottom-end",
    // Position against the viewport so the portalled menu tracks the trigger
    // regardless of which ancestor scrolls.
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, role, listNav]);

  const items: Array<{ icon: typeof UserCircle; label: string; kind: MenuPick; destructive?: boolean }> = [
    { icon: UserCircle, label: "View Profile", kind: "view" },
    { icon: Pencil, label: "Edit User", kind: "edit" },
    { icon: ShieldCheck, label: "Manage Access", kind: "access" },
    { icon: KeyRound, label: "Reset Password", kind: "reset" },
    // Self-destructive actions are hidden on your own row; the server rejects
    // them regardless — this is presentation, not the control.
    ...(isSelf
      ? []
      : [
          {
            icon: user.isActive ? AlertTriangle : ShieldCheck,
            label: user.isActive ? "Deactivate" : "Activate",
            kind: "toggle" as MenuPick,
          },
          { icon: Trash2, label: "Delete User", kind: "delete" as MenuPick, destructive: true },
        ]),
  ];

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: (e) => {
            // Stop the row/card click handler from also firing.
            e.stopPropagation();
            onSetOpen(!open);
          },
        })}
        className="rounded-md p-1.5 hover:bg-muted"
        aria-label={`Actions for ${user.name ?? user.email}`}
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
              className="z-50 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
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
                      // stopPropagation so the click cannot also reach the row;
                      // close before acting so the menu is never left hanging
                      // over a modal.
                      e.stopPropagation();
                      onSetOpen(false);
                      onPick(item.kind);
                    },
                  })}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted",
                    activeIndex === i && "bg-muted",
                    item.destructive && "text-status-error"
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
    </>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

function dialogTitle(kind: string, user: UserRow): string {
  const who = user.name ?? user.email;
  switch (kind) {
    case "view": return who;
    case "edit": return `Edit ${who}`;
    case "access": return `Manage access — ${who}`;
    case "reset": return `Reset password — ${who}`;
    case "toggle": return user.isActive ? `Deactivate ${who}?` : `Activate ${who}?`;
    default: return `Delete ${who}?`;
  }
}

function ViewProfile({ user }: { user: UserRow }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      <Field label="Email" value={user.email} />
      <Field label="Phone" value={user.phone ?? "—"} />
      <Field label="Role" value={roleLabel(user.role)} />
      <Field label="Brand" value={user.tenantName ?? "All brands"} />
      <Field label="Store" value={user.locationName ?? "—"} />
      <Field label="Status" value={user.isActive ? "Active" : "Inactive"} />
      <Field label="Sign-in" value={user.hasPassword ? "Password + Google" : "Google only"} />
      <Field label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"} />
      <Field label="Created" value={formatDate(user.createdAt)} />
    </dl>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * Edit / Manage Access form.
 *
 * `mode` decides which fields show — "edit" for profile details, "access" for
 * role and scope — but both submit through the same validated action, so the
 * server rules apply either way.
 *
 * Deactivating asks for confirmation inline: it signs the user out
 * immediately, which is not obvious from a checkbox alone.
 */
function EditForm({
  user,
  mode,
  brandOptions,
  isSelf,
  pending,
  onSubmit,
}: {
  user: UserRow;
  mode: "edit" | "access";
  brandOptions: Option[];
  isSelf: boolean;
  pending: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<string>(user.role ?? "FRANCHISEE_USER");
  const [tenantId, setTenantId] = useState(user.tenantId ?? "");
  const [isActive, setIsActive] = useState(user.isActive);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const willDeactivate = user.isActive && !isActive;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (willDeactivate && !confirmDeactivate) {
      setConfirmDeactivate(true);
      return;
    }
    onSubmit(
      mode === "edit"
        ? { name, email, phone, isActive }
        : { role, tenantId: role === "KICK_ADMIN" ? "" : tenantId }
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {mode === "edit" ? (
        <>
          <Labelled label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} disabled={pending} required />
          </Labelled>
          <Labelled label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} disabled={pending} />
          </Labelled>

          <label className={cn("flex items-center gap-2 text-sm", isSelf ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setConfirmDeactivate(false);
              }}
              // Self-deactivation is blocked server-side; disabling here just
              // avoids offering an action that will be refused.
              disabled={pending || isSelf}
              className="h-4 w-4 rounded border-border accent-status-info"
            />
            Active — can sign in
            {isSelf && <span className="text-xs text-muted-foreground">(cannot change your own)</span>}
          </label>

          {willDeactivate && confirmDeactivate && (
            <div className="flex items-start gap-2 rounded-lg bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{user.email}</strong> will be signed out immediately. Press Save again to confirm.
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <Labelled label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputCls}
              // An admin removing their own Super Admin role could lock the
              // platform out; refused server-side too.
              disabled={pending || (isSelf && user.role === "KICK_ADMIN")}
            >
              <option value="KICK_ADMIN">Super Admin</option>
              <option value="FRANCHISOR_ADMIN">Franchisor Admin</option>
              <option value="FRANCHISEE_USER">Franchisee User</option>
            </select>
          </Labelled>

          {isSelf && user.role === "KICK_ADMIN" && (
            <p className="text-xs text-muted-foreground">You cannot change your own Super Admin role.</p>
          )}

          {role !== "KICK_ADMIN" && (
            <Labelled label="Brand access">
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={inputCls} disabled={pending} required>
                <option value="">Select a brand…</option>
                {brandOptions.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </Labelled>
          )}

          <p className="text-xs text-muted-foreground">
            {role === "KICK_ADMIN"
              ? "Super Admins have platform-wide access, so no brand is assigned."
              : role === "FRANCHISOR_ADMIN"
                ? "Franchisor Admins manage one brand's stores, announcements and tasks. They have no access to commerce, pricing, orders, allowances, rebates or payments."
                : "Franchisee Users are scoped to one store and must have an active store assigned."}
          </p>
        </>
      )}

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {willDeactivate && confirmDeactivate ? "Confirm & save" : "Save changes"}
      </button>
    </form>
  );
}

function ResetForm({ pending, onSubmit }: { pending: boolean; onSubmit: (pw: string, confirm: string) => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pw, confirm);
      }}
      className="flex flex-col gap-3"
    >
      <Labelled label="New password">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} disabled={pending} autoComplete="new-password" />
      </Labelled>
      <Labelled label="Confirm password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} disabled={pending} autoComplete="new-password" />
      </Labelled>
      <p className="text-xs text-muted-foreground">Any active sessions are ended, so the user must sign in again.</p>
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Reset password
      </button>
    </form>
  );
}

function ConfirmStatus({
  user,
  pending,
  onConfirm,
  onCancel,
}: {
  user: UserRow;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const deactivating = user.isActive;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {deactivating ? (
          <>
            <strong className="text-foreground">{user.email}</strong> will be signed out immediately and blocked from
            signing in. Their data and history are kept.
          </>
        ) : (
          <>
            <strong className="text-foreground">{user.email}</strong> will be able to sign in again with their existing
            credentials.
          </>
        )}
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={pending} className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={pending}
          className={cn(
            "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60",
            deactivating ? "bg-status-warning" : "bg-status-success"
          )}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {deactivating ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}

function ConfirmDelete({
  user,
  pending,
  onConfirm,
  onCancel,
}: {
  user: UserRow;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This permanently deletes <strong>{user.email}</strong> and their access. Their audit history is kept. This
          cannot be undone.
        </span>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={pending} className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete user
        </button>
      </div>
    </div>
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
const primaryBtn =
  "mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-status-info text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60";

function Avatar({ name }: { name: string }) {
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials || "?"}
    </span>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  const map: Record<string, string> = {
    KICK_ADMIN: "bg-purple-100 text-purple-700",
    FRANCHISOR_ADMIN: "bg-blue-100 text-blue-700",
    FRANCHISEE_USER: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", role ? map[role] : "bg-muted text-muted-foreground")}>
      {roleLabel(role)}
    </span>
  );
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "KICK_ADMIN": return "Super Admin";
    case "FRANCHISOR_ADMIN": return "Franchisor";
    case "FRANCHISEE_USER": return "Franchisee";
    default: return "No access";
  }
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-status-success" : "bg-status-error")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeTime(d: Date | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(d);
}
