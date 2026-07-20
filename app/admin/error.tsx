"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

/**
 * Admin section error boundary. Without this, an unhandled server error in any
 * /admin route renders Next.js's default crash page (no nav, no branding, no
 * recovery). Keeps the admin shell usable and offers a retry.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface in the browser console / error reporting for debugging.
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-xl border border-status-error/30 bg-status-error/5 px-6 py-12 text-center"
    >
      <AlertCircle className="h-8 w-8 text-status-error" aria-hidden="true" />
      <h2 className="text-base font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        This page couldn&apos;t load. The error has been logged — try again, and if it keeps happening contact support.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>
    </div>
  );
}
