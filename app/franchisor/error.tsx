"use client";

import { AlertCircle } from "lucide-react";

export default function FranchisorError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-status-error/30 bg-status-error/5 px-6 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-status-error" aria-hidden="true" />
      <p className="text-sm text-status-error">Something went wrong loading this page.</p>
      <button onClick={reset} className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
        Try again
      </button>
    </div>
  );
}
