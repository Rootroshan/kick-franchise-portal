"use client";

import { cn } from "@/lib/utils";

/**
 * CSS-only skeleton shimmer. The animate-pulse gives a subtle pulse effect that
 * communicates loading without being distracting. Respects prefers-reduced-motion.
 */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted motion-safe:animate-pulse",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton rows for a table — same column structure as DataTable so the layout
 * doesn't shift when real data arrives.
 */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex border-b border-border bg-muted/40 px-3 py-2.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3 flex-1 rounded", i === 0 && "max-w-[160px]")} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center border-b border-border px-3 last:border-0">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className={cn("flex h-11 flex-1 items-center", i === 0 ? "max-w-[160px]" : "")}>
              {i === 0 ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                </div>
              ) : i === columns - 1 ? (
                <div className="ml-auto flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              ) : (
                <Skeleton className={cn("h-3 rounded", i % 3 === 0 ? "w-16" : "w-12")} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton cards grid — matches the Artwork Hub grid layout (4 columns on lg).
 */
export function CardsSkeleton({
  count = 8,
  variant = "card",
}: {
  count?: number;
  variant?: "card" | "brand" | "stat";
}) {
  if (variant === "stat") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="mb-1 h-7 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "brand") {
    return (
      <div className="rounded-xl border border-border bg-card">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
            <Skeleton className="h-3 w-16 rounded" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * List skeleton for non-table sections like the NotificationInbox.
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <Skeleton className="mt-0.5 h-4 w-4 rounded-sm" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
