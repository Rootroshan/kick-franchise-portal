import { cn } from "@/lib/utils";

/** Centered loading spinner. Fills its parent and centers a spinning ring. */
export function Spinner({ className, label = "Loading…" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex min-h-[40vh] w-full flex-col items-center justify-center gap-3", className)} role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
