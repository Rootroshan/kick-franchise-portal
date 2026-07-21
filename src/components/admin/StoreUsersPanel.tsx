"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, AlertCircle, Trash2, KeyRound, Pencil, PauseCircle, PlayCircle, Mail, RotateCw } from "lucide-react";
import {
  createStoreUserAction,
  updateStoreUserAction,
  setStoreUserActiveAction,
  resetStoreUserPasswordAction,
  deleteStoreUserAction,
  inviteStoreUserAction,
  resendStoreUserInvitationAction,
} from "@/app/admin/stores/[id]/userActions";
import type { InvitationRow } from "@/server/auth/invitations";
import { cn } from "@/lib/utils";

export type StoreUserRow = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  storeRole: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

const INVITE_STATUS_VARIANT: Record<InvitationRow["status"], string> = {
  PENDING: "bg-status-warning/15 text-status-warning",
  ACCEPTED: "bg-status-success/15 text-status-success",
  EXPIRED: "bg-muted text-muted-foreground",
  FAILED: "bg-status-error/15 text-status-error",
};

/**
 * Franchisee users for one store.
 *
 * Every action posts to a store-scoped server action that pins role to
 * FRANCHISEE_USER and both tenant and location to this store, so nothing
 * here can create a platform/franchisor admin or attach a user elsewhere.
 * An operator can either set a password directly (useful when email isn't
 * configured) or send an invitation the invitee accepts by setting their
 * own password.
 */
export function StoreUsersPanel({
  tenantId,
  locationId,
  users,
  invitations,
}: {
  tenantId: string;
  locationId: string;
  users: StoreUserRow[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ kind: "create" | "invite" | "edit" | "reset" | "delete"; user?: StoreUserRow } | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Team</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setDialog({ kind: "invite" })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Invite
          </button>
          <button
            onClick={() => setDialog({ kind: "create" })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-status-info px-3 text-xs font-semibold text-white hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add User
          </button>
        </div>
      </div>

      {invitations.length > 0 && (
        <div className="mb-4 rounded-lg border border-border">
          <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            Invitations
          </p>
          <ul className="divide-y divide-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{inv.displayName}</div>
                  <div className="truncate text-xs text-muted-foreground">{inv.email}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", INVITE_STATUS_VARIANT[inv.status])}>
                    {inv.status[0]}{inv.status.slice(1).toLowerCase()}
                  </span>
                  {inv.status !== "ACCEPTED" && (
                    <button
                      onClick={() => run(() => resendStoreUserInvitationAction(inv.id, locationId))}
                      disabled={pending}
                      title="Resend invitation"
                      aria-label="Resend invitation"
                      className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-60"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Nobody is assigned to this store yet.
        </p>
      ) : (
        <div className="scrollbar-hide overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-foreground/70">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{u.displayName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-foreground">{u.email ?? "—"}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                      {u.storeRole === "MANAGER" ? "Manager" : "User"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                        u.isActive ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"
                      )}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-CA") : "Never"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("en-CA")}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn label="Edit" onClick={() => setDialog({ kind: "edit", user: u })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn label="Reset password" onClick={() => setDialog({ kind: "reset", user: u })}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        label={u.isActive ? "Deactivate" : "Activate"}
                        onClick={() => run(() => setStoreUserActiveAction(u.userId, locationId, !u.isActive))}
                      >
                        {u.isActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                      </IconBtn>
                      <IconBtn label="Delete" destructive onClick={() => setDialog({ kind: "delete", user: u })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "create" && (
        <CreateDialog
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(data) => run(() => createStoreUserAction(tenantId, locationId, data))}
        />
      )}

      {dialog?.kind === "invite" && (
        <InviteDialog
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(data) => run(() => inviteStoreUserAction(tenantId, locationId, data))}
        />
      )}

      {dialog?.kind === "edit" && dialog.user && (
        <EditDialog
          user={dialog.user}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(data) => run(() => updateStoreUserAction(dialog.user!.userId, locationId, data))}
        />
      )}

      {dialog?.kind === "reset" && dialog.user && (
        <ResetDialog
          user={dialog.user}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={(pw) => run(() => resetStoreUserPasswordAction(dialog.user!.userId, locationId, pw))}
        />
      )}

      {dialog?.kind === "delete" && dialog.user && (
        <Modal title={`Delete ${dialog.user.displayName ?? dialog.user.email}?`} onClose={() => setDialog(null)}>
          <p className="text-sm text-muted-foreground">
            This permanently removes <strong className="text-foreground">{dialog.user.email}</strong> and their access.
            Audit history is preserved. This cannot be undone.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setDialog(null)} disabled={pending} className={secondaryBtn}>
              Cancel
            </button>
            <button
              onClick={() => run(() => deleteStoreUserAction(dialog.user!.userId, locationId))}
              disabled={pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("rounded-md border border-border p-1.5 hover:bg-muted", destructive && "text-status-error")}
    >
      {children}
    </button>
  );
}

function CreateDialog({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", storeRole: "USER", isActive: true });
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal title="Add store user" onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form.password.length < 8) return setError("Password must be at least 8 characters.");
          setError(null);
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <Labelled label="Full name">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} disabled={pending} required autoComplete="off" />
        </Labelled>
        <Labelled label="Phone">
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Password">
          <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} disabled={pending} required autoComplete="new-password" />
        </Labelled>
        <Labelled label="Access level">
          <select value={form.storeRole} onChange={(e) => setForm((f) => ({ ...f, storeRole: e.target.value }))} className={inputCls} disabled={pending}>
            <option value="USER">User — no team management</option>
            <option value="MANAGER">Manager — can manage this store&rsquo;s team</option>
          </select>
        </Labelled>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} disabled={pending} className="h-4 w-4 rounded border-border accent-status-info" />
          Active — can sign in immediately
        </label>

        {error && <ErrorLine message={error} />}
        <Actions pending={pending} onCancel={onCancel} label="Create user" />
      </form>
    </Modal>
  );
}

function InviteDialog({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", storeRole: "USER" });

  return (
    <Modal title="Invite store user" onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <p className="text-xs text-muted-foreground">
          Sends an email with a link to set up their account. No password is set here.
        </p>
        <Labelled label="Full name">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} disabled={pending} required autoComplete="off" />
        </Labelled>
        <Labelled label="Phone">
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Access level">
          <select value={form.storeRole} onChange={(e) => setForm((f) => ({ ...f, storeRole: e.target.value }))} className={inputCls} disabled={pending}>
            <option value="USER">User — no team management</option>
            <option value="MANAGER">Manager — can manage this store&rsquo;s team</option>
          </select>
        </Labelled>

        <Actions pending={pending} onCancel={onCancel} label="Send invitation" />
      </form>
    </Modal>
  );
}

function EditDialog({
  user,
  pending,
  onCancel,
  onSubmit,
}: {
  user: StoreUserRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: user.displayName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    storeRole: user.storeRole ?? "USER",
  });

  return (
    <Modal title={`Edit ${user.displayName ?? user.email}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <Labelled label="Full name">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Phone">
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} disabled={pending} required />
        </Labelled>
        <Labelled label="Access level">
          <select value={form.storeRole} onChange={(e) => setForm((f) => ({ ...f, storeRole: e.target.value }))} className={inputCls} disabled={pending}>
            <option value="USER">User — no team management</option>
            <option value="MANAGER">Manager — can manage this store&rsquo;s team</option>
          </select>
        </Labelled>
        <Actions pending={pending} onCancel={onCancel} label="Save changes" />
      </form>
    </Modal>
  );
}

function ResetDialog({
  user,
  pending,
  onCancel,
  onSubmit,
}: {
  user: StoreUserRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (pw: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal title={`Reset password — ${user.displayName ?? user.email}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw !== confirm) return setError("Passwords do not match.");
          if (pw.length < 8) return setError("Password must be at least 8 characters.");
          setError(null);
          onSubmit(pw);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <Labelled label="New password">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} disabled={pending} autoComplete="new-password" required />
        </Labelled>
        <Labelled label="Confirm password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} disabled={pending} autoComplete="new-password" required />
        </Labelled>
        <p className="text-xs text-muted-foreground">Active sessions are ended, so the user must sign in again.</p>
        {error && <ErrorLine message={error} />}
        <Actions pending={pending} onCancel={onCancel} label="Reset password" />
      </form>
    </Modal>
  );
}

function Actions({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
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
        {label}
      </button>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
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

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const inputCls = "min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal disabled:opacity-60";
const secondaryBtn = "min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60";
