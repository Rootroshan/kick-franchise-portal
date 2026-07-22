/** Opening task… — detail-page skeleton. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Opening task">
      <div className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-7 w-2/3 rounded bg-muted motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-32 rounded-xl border border-border bg-card motion-safe:animate-pulse" aria-hidden="true" />
      <div className="h-12 rounded-lg bg-muted motion-safe:animate-pulse" aria-hidden="true" />
    </div>
  );
}
