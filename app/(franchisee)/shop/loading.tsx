/** Shop route skeleton — mirrors ShopBrowser's layout (toolbar, allowance card,
 *  category cards, product grid) so real data doesn't shift the page. */
export default function ShopLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading products…">
      <div className="space-y-2">
        <div className="h-7 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded-md bg-muted motion-safe:animate-pulse" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="h-10 flex-1 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-10 w-40 rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      </div>

      <div className="h-28 rounded-xl bg-muted motion-safe:animate-pulse" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted motion-safe:animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-square w-full bg-muted motion-safe:animate-pulse" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3.5 w-16 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
