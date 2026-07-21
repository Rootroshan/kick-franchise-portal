"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteTaskAction } from "@/app/franchisor/tasks/actions";

export function TaskDeleteButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const onDelete = () =>
    start(async () => {
      try {
        await deleteTaskAction(id);
        // deleteTaskAction redirects on success — reaching this line at all
        // means it returned instead, which only happens on failure paths
        // that throw rather than redirect (defensive; see actions.ts).
      } catch (e) {
        setOpen(false);
        toast.error(e instanceof Error ? e.message : "Failed to delete task");
      }
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-status-error hover:bg-status-error/10"
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">Delete &ldquo;{title}&rdquo;?</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2.5 text-sm text-status-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This permanently removes the task and its store assignments. If any store has already completed it,
                the delete will be refused — that completion record is history.
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={pending}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
