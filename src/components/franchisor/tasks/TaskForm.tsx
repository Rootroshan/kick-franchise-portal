"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export type Store = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Create/edit task form. On create it shows a searchable store multi-select
 * (each store gets its own TaskAssignment). On edit, assignments are managed
 * on the detail page, so `stores` is omitted.
 */
export function TaskForm({
  action,
  stores,
  defaultValues,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  stores?: Store[];
  defaultValues?: { title?: string; details?: string; dueAt?: string; selected?: string[] };
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValues?.selected ?? []));

  const filteredStores = (stores ?? []).filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  const allSelected = stores && stores.length > 0 && selected.size === stores.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!title.trim()) {
          e.preventDefault();
          toast.error("Title is required.");
          return;
        }
        if (stores && selected.size === 0) {
          e.preventDefault();
          toast.error("Select at least one store.");
        }
      }}
      className="flex flex-col gap-5"
    >
      <label htmlFor="title" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Title <span className="text-status-error">*</span></span>
        <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </label>

      <label htmlFor="details" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea id="details" name="details" defaultValue={defaultValues?.details ?? ""} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </label>

      <label htmlFor="dueAt" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Due date &amp; time</span>
        <input id="dueAt" name="dueAt" type="datetime-local" defaultValue={defaultValues?.dueAt ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-xs" />
      </label>

      {stores && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Assign to stores <span className="text-status-error">*</span></legend>
          <div className="flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stores…" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(stores.map((s) => s.id)))} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="max-h-56 scrollbar-hide overflow-y-auto rounded-md border border-border">
            {filteredStores.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No stores match.</p>
            ) : (
              filteredStores.map((s) => (
                <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-border px-3 last:border-0 hover:bg-muted">
                  <input type="checkbox" name="locationIds" value={s.id} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 rounded border-input" />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))
            )}
          </div>
          <span className="text-xs text-muted-foreground">{selected.size} store{selected.size === 1 ? "" : "s"} selected</span>
        </fieldset>
      )}

      <div className="pt-1"><SubmitButton label={submitLabel} /></div>
    </form>
  );
}
