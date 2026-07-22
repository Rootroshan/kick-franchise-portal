/** Route-level skeleton for /orders/[orderId]. */
export default function OrderDetailLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Opening order…">
      <div className="h-4 w-28 rounded bg-muted motion-safe:animate-pulse" />
      <div className="flex items-start justify-between">
        <div>
          <div className="h-6 w-24 rounded bg-muted motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-40 rounded bg-muted motion-safe:animate-pulse" />
        </div>
        <div className="h-5 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
          <div className="mt-3 flex flex-col gap-2">
            <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
      <span className="sr-only">Opening order…</span>
    </div>
  );
}
