"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/** Minimal hand-written dialog (no Radix dependency installed) — backdrop + panel, closes on backdrop click or Escape. */
function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}

function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-h-[85vh] scrollbar-hide overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg", className)} {...props}>
      {children}
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-sm text-muted-foreground hover:text-foreground" aria-label="Close">
      <X className="h-4 w-4" />
    </button>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose };
