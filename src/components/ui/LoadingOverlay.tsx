"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Centred modal/action loading overlay — use for delete, deactivate, create,
 * save, upload, verify, and bulk operations. Renders a semi-transparent backdrop
 * with a centred spinner + message so the page beneath stays visible but
 * interaction is blocked.
 */
export function LoadingOverlay({
  message = "Processing…",
  className,
  spinnerClassName,
}: {
  message?: string;
  className?: string;
  spinnerClassName?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/95 px-8 py-6 shadow-xl backdrop-blur">
        <Loader2 className={cn("h-7 w-7 animate-spin text-primary", spinnerClassName)} aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{message}</p>
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
}

/**
 * Inline action spinner for buttons — pairs with disabled state so the button
 * cannot be clicked again while the action runs.
 */
export function ActionSpinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
      <span className="sr-only">{label || "Loading"}</span>
    </span>
  );
}
