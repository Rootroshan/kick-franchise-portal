import { ListSkeleton } from "@/components/ui/skeletons";

/** Skeleton feed while the announcements list streams in. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-14 rounded-xl border border-border bg-card motion-safe:animate-pulse" aria-hidden="true" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListSkeleton count={4} />
        </div>
        <div className="hidden lg:col-span-1 lg:block">
          <ListSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
