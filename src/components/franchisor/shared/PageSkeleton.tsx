/** Generic franchisor page loading skeleton (header + content blocks). */
export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-8 w-56 rounded bg-muted" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
