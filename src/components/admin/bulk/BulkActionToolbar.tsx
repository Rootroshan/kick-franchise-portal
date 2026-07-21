"use client";

import { useState, useTransition, useRef } from "react";
import { X, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useBulkSelection } from "./BulkSelection";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { cn } from "@/lib/utils";

export type BulkActionDef = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  /** "destructive" | "warning" | "default" */
  tone?: "destructive" | "warning" | "default" | "success";
  confirmTitle?: string;
  confirmMessage?: string;
  /** Server action that receives selected IDs as string[] and returns ActionResult */
  action: (ids: string[]) => Promise<{ ok: boolean; message: string; partial?: boolean }>;
};

type Props = {
  actions: BulkActionDef[];
  /** Human-readable name for selected items, e.g. "brand" or "user" */
  itemName: string;
  className?: string;
};

export function BulkActionToolbar({ actions, itemName, className }: Props) {
  const { selected, deselectAll, actionState, resetAction } = useBulkSelection();
  const count = selected.size;

  if (count === 0 && !actionState.loading) return null;

  return (
    <>
      {/* Loading overlay — shown while a bulk action is executing */}
      {actionState.loading && (
        <LoadingOverlay
          message={actionState.runningAction ?? `${count} ${itemName}${count === 1 ? "" : "s"}…`}
        />
      )}

      {/* Action feedback toast — shown at top when action completes */}
      {actionState.message && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed top-20 left-1/2 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg -translate-x-1/2",
            actionState.kind === "success" && "bg-status-success text-white",
            actionState.kind === "error" && "bg-status-error text-white",
            actionState.kind === "partial" && "bg-status-warning text-white"
          )}
        >
          {actionState.kind === "partial" && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {actionState.kind === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {actionState.kind === "error" && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {actionState.message}
          <button onClick={resetAction} aria-label="Dismiss" className="ml-1 rounded hover:bg-white/20 p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-info/30 bg-status-info/5 px-4 py-2.5",
          className
        )}
        aria-label={`${count} ${itemName}${count === 1 ? "" : "s"} selected`}
      >
        <div className="flex items-center gap-3">
          {/* Selection count */}
          <span className="flex items-center gap-1.5 text-sm font-semibold text-status-info">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {count} {itemName}{count === 1 ? "" : "s"} selected
          </span>

          {/* Divider + actions */}
          <div className="flex items-center gap-1">
            {actions.map((a) => (
              <BulkActionButton key={a.key} action={a} count={count} itemName={itemName} />
            ))}
          </div>
        </div>

        {/* Clear selection */}
        <button
          onClick={deselectAll}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
    </>
  );
}

function BulkActionButton({
  action,
  count,
  itemName,
}: {
  action: BulkActionDef;
  count: number;
  itemName: string;
}) {
  const { runAction, selected } = useBulkSelection();
  const [open, setOpen] = useTransition();
  const [confirming, setConfirming] = useState<"confirm" | "typing" | null>(null);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const toneCls = {
    destructive: "text-status-error hover:bg-status-error/10",
    warning: "text-status-warning hover:bg-status-warning/10",
    success: "text-status-success hover:bg-status-success/10",
    default: "text-muted-foreground hover:bg-muted",
  }[action.tone ?? "default"];

  const iconBgCls = {
    destructive: "bg-status-error/10",
    warning: "bg-status-warning/10",
    success: "bg-status-success/10",
    default: "bg-muted",
  }[action.tone ?? "default"];

  const needsConfirm = action.tone === "destructive" && action.confirmTitle;

  const loadingLabel = `${action.label} ${count} ${itemName}${count === 1 ? "" : "s"}…`;

  const handleTrigger = () => {
    if (needsConfirm) {
      setConfirming("confirm");
      setTyped("");
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setOpen(() => {
        runAction(loadingLabel, () => action.action([...selected]));
      });
    }
  };

  const handleConfirm = () => {
    if (typed.trim() !== `delete ${count} ${itemName}${count === 1 ? "" : "s"}`) return;
    setConfirming(null);
    setTyped("");
    runAction(loadingLabel, () => action.action([...selected]));
  };

  const handleCancel = () => {
    setConfirming(null);
    setTyped("");
  };

  return (
    <>
      <button
        onClick={handleTrigger}
        disabled={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
          toneCls
        )}
        aria-label={action.label}
      >
        {action.icon && (
          <span className={cn("flex h-5 w-5 items-center justify-center rounded", iconBgCls)}>
            <action.icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
        {action.label}
      </button>

      {/* Confirm dialog for destructive bulk actions */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-status-error">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              {action.confirmTitle ?? `Delete ${count} ${itemName}${count === 1 ? "" : "s"}?`}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {action.confirmMessage ??
                `This will permanently delete ${count} ${itemName}${count === 1 ? "" : "s"}. This cannot be undone.`}
            </p>

            {/* Summary of items being deleted */}
            <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">{count} {itemName}{count === 1 ? "" : "s"} will be deleted.</p>
              <p>All related records (stores, members, orders, payments) will be preserved.</p>
            </div>

            <label className="mb-3 block text-sm">
              Type{" "}
              <strong className="text-foreground">&ldquo;delete {count} {itemName}{count === 1 ? "" : "s"}&rdquo;</strong>{" "}
              to confirm:
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typed.trim() === `delete ${count} ${itemName}${count === 1 ? "" : "s"}`) handleConfirm();
                  if (e.key === "Escape") handleCancel();
                }}
                className="mt-1.5 min-h-10 w-full rounded-md border border-status-error/40 bg-background px-3 text-sm"
                autoComplete="off"
              />
            </label>

            <div className="flex gap-2">
              <button onClick={handleCancel} className="min-h-10 flex-1 rounded-md border border-border text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={
                  typed.trim() !== `delete ${count} ${itemName}${count === 1 ? "" : "s"}`
                }
                className="min-h-10 flex-1 items-center justify-center rounded-md bg-status-error text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 inline-flex gap-2"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete {count} {itemName}{count === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


