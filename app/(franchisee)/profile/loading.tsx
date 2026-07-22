/** Skeleton for My Account — mirrors the two-column card layout so nothing shifts. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-32 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded-md bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="h-24 rounded-xl border border-border bg-card p-4">
            <div className="h-14 w-14 rounded-full bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="h-56 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
          <div className="h-72 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-44 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
          <div className="h-52 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
          <div className="h-32 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
