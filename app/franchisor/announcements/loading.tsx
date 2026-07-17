export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-8 w-56 rounded bg-muted" />
      <div className="mb-3 h-8 w-full max-w-md rounded bg-muted" />
      <div className="mb-3 h-9 w-full rounded bg-muted" />
      <div className="rounded-xl border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-border last:border-0" />
        ))}
      </div>
    </div>
  );
}
