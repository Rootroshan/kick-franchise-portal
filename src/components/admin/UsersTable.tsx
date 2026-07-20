"use client";

import { useState, useTransition, useRef, useEffect } from "react";
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "view" | "edit" | "access" | "reset" | "delete"; user: UserRow } | null>(
    null
  );
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
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
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
                    open={openMenu === u.id}
                    onToggle={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                    onPick={(kind) => {
                      setOpenMenu(null);
                      if (kind === "toggle") {
                        run(() => setUserActiveAction(u.id, !u.isActive));
                      } else {
                        setDialog({ kind, user: u });
                      }
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
                open={openMenu === u.id}
                onToggle={() => setOpenMenu(openMenu === u.id ? null : u.id)}
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

function RowMenu({
  user,
  isSelf,
  open,
  onToggle,
  onPick,
}: {
  user: UserRow;
  isSelf: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (kind: MenuPick) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onToggle();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={onToggle}
        className="rounded-md p-1.5 hover:bg-muted"
        aria-label={`Actions for ${user.name ?? user.email}`}
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          <MenuItem icon={UserCircle} label="View Profile" onClick={() => onPick("view")} />
          <MenuItem icon={Pencil} label="Edit User" onClick={() => onPick("edit")} />
          <MenuItem icon={ShieldCheck} label="Manage Access" onClick={() => onPick("access")} />
          <MenuItem icon={KeyRound} label="Reset Password" onClick={() => onPick("reset")} />
          {/* Self-destructive actions are hidden for your own row; the server
              rejects them regardless. */}
          {!isSelf && (
            <>
              <MenuItem
                icon={user.isActive ? AlertTriangle : ShieldCheck}
                label={user.isActive ? "Deactivate" : "Activate"}
                onClick={() => onPick("toggle")}
              />
              <MenuItem icon={Trash2} label="Delete User" destructive onClick={() => onPick("delete")} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof UserCircle;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted",
        destructive && "text-status-error"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
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

function EditForm({
  user,
  mode,
  brandOptions,
  pending,
  onSubmit,
}: {
  user: UserRow;
  mode: "edit" | "access";
  brandOptions: Option[];
  pending: boolean;
  onSubmit: (data: { name?: string; phone?: string; role?: string; tenantId?: string }) => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<string>(user.role ?? "FRANCHISEE_USER");
  const [tenantId, setTenantId] = useState(user.tenantId ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(mode === "edit" ? { name, phone } : { role, tenantId });
      }}
      className="flex flex-col gap-3"
    >
      {mode === "edit" ? (
        <>
          <Labelled label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} disabled={pending} />
          </Labelled>
          <Labelled label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} disabled={pending} />
          </Labelled>
        </>
      ) : (
        <>
          <Labelled label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} disabled={pending}>
              <option value="KICK_ADMIN">Super Admin</option>
              <option value="FRANCHISOR_ADMIN">Franchisor Admin</option>
              <option value="FRANCHISEE_USER">Franchisee User</option>
            </select>
          </Labelled>
          {role !== "KICK_ADMIN" && (
            <Labelled label="Brand">
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className={inputCls}
                disabled={pending}
              >
                <option value="">Select a brand…</option>
                {brandOptions.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </Labelled>
          )}
          {role === "KICK_ADMIN" && (
            <p className="text-xs text-muted-foreground">
              Super Admins have platform-wide access, so no brand is assigned.
            </p>
          )}
        </>
      )}

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
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
