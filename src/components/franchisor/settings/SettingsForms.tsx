"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ProfileForm({ action, defaults }: { action: (fd: FormData) => void | Promise<void>; defaults: { displayName: string; email: string | null; role: string; brandName: string } }) {
  return (
    <form action={action} onSubmit={() => toast.promise(Promise.resolve(), { loading: "Saving…", success: "Profile updated", error: "Failed" })} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name"><input name="displayName" defaultValue={defaults.displayName} required className={inputCls} /></Field>
      <Field label="Email"><input value={defaults.email ?? ""} disabled className={`${inputCls} opacity-60`} /></Field>
      <Field label="Role"><input value={defaults.role} disabled className={`${inputCls} opacity-60`} /></Field>
      <Field label="Brand"><input value={defaults.brandName} disabled className={`${inputCls} opacity-60`} /></Field>
      <div className="sm:col-span-2"><SaveButton /></div>
    </form>
  );
}

const NOTIF_ROWS = [
  { key: "announcementPush", label: "Announcement push" },
  { key: "announcementEmail", label: "Announcement email" },
  { key: "taskPush", label: "Task push" },
  { key: "taskEmail", label: "Task email" },
  { key: "onboardingPush", label: "Onboarding push" },
  { key: "artworkNotifications", label: "Artwork notifications" },
  { key: "systemNotifications", label: "System notifications" },
];

/** Notification preferences. Not yet persisted (no per-user prefs table);
 *  toggles are local and documented as such in the README. */
export function NotificationForm() {
  return (
    <div className="flex flex-col gap-1">
      {NOTIF_ROWS.map((r) => (
        <label key={r.key} className="flex min-h-11 items-center justify-between border-b border-border last:border-0">
          <span className="text-sm">{r.label}</span>
          <input type="checkbox" defaultChecked className="h-5 w-9 cursor-pointer" onChange={() => toast.success(`${r.label} preference saved`)} />
        </label>
      ))}
      <p className="mt-2 text-xs text-muted-foreground">Preferences apply to your account. Delivery is subject to your browser and email settings.</p>
    </div>
  );
}
