"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export type AnnouncementFormValues = {
  title: string;
  body: string;
  isPinned: boolean;
  requiresAck: boolean;
  publishAt: string; // datetime-local value
  expiresAt: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Create/edit announcement form. Single-column on mobile, two-column on desktop.
 * Submits to a server action passed as `action`. Client-side required-field
 * guard surfaces a toast before the round-trip.
 */
export function AnnouncementForm({
  action,
  defaultValues,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Partial<AnnouncementFormValues>;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [body, setBody] = useState(defaultValues?.body ?? "");

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!title.trim() || !body.trim()) {
          e.preventDefault();
          toast.error("Title and body are required.");
        }
      }}
      className="flex flex-col gap-5"
    >
      <Field label="Title" htmlFor="title" required>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </Field>

      <Field label="Body" htmlFor="body" required>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Publish at (leave empty to publish now)" htmlFor="publishAt">
          <input
            id="publishAt"
            name="publishAt"
            type="datetime-local"
            defaultValue={defaultValues?.publishAt ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Expires at (optional)" htmlFor="expiresAt">
          <input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={defaultValues?.expiresAt ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <Toggle name="isPinned" label="Pin to top of store feed" defaultChecked={defaultValues?.isPinned} />
        <Toggle name="requiresAck" label="Require acknowledgement from stores" defaultChecked={defaultValues?.requiresAck} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function Field({ label, htmlFor, required, children }: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-status-error"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-input" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
