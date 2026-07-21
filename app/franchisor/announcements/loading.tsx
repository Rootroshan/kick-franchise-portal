export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-8 w-56 rounded bg-muted" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <div className="h-24 rounded-xl border border-border bg-muted/40" />
          <div className="h-8 w-full max-w-md rounded bg-muted" />
          <div className="h-9 w-full rounded bg-muted" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-border bg-muted/40" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      </div>
    </div>
  );
}
