"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Client confirm dialog wrapping a server action. Renders its own trigger.
 * `action` is a server action that throws on failure; we surface the error
 * via toast and keep the dialog open so nothing is lost.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const run = () => {
    start(async () => {
      try {
        await action();
        toast.success(`${title} — done`);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              {destructive && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-error/10">
                  <AlertTriangle className="h-5 w-5 text-status-error" />
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={run}
                disabled={pending}
                className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  destructive ? "bg-status-error hover:opacity-90" : "bg-primary hover:opacity-90"
                }`}
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
