/** Route-level skeleton for /orders — mirrors the real layout so nothing shifts. */
export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading orders…">
      <div>
        <div className="h-6 w-36 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="mt-2 h-4 w-64 rounded-md bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="h-10 w-10 rounded-full bg-muted motion-safe:animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
              <div className="mt-2 h-5 w-8 rounded bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-10 w-80 max-w-full rounded-lg bg-muted motion-safe:animate-pulse" />
      <div className="h-10 rounded-md bg-muted motion-safe:animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="mt-3 h-3 w-40 rounded bg-muted motion-safe:animate-pulse" />
          <div className="mt-2 h-4 w-16 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
      <span className="sr-only">Loading orders…</span>
    </div>
  );
}
