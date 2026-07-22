import { CardsSkeleton, ListSkeleton } from "@/components/ui/skeletons";

/** Loading tasks… — summary-card + task-row skeletons while the page streams. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading tasks">
      <div className="h-10 w-48 rounded-md bg-muted motion-safe:animate-pulse" aria-hidden="true" />
      <CardsSkeleton count={5} variant="stat" />
      <div className="h-24 rounded-xl border border-border bg-card motion-safe:animate-pulse" aria-hidden="true" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListSkeleton count={5} />
        </div>
        <div className="hidden lg:col-span-1 lg:block">
          <ListSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
