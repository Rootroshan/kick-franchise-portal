export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-8 w-64 rounded bg-muted" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="h-64 rounded-xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 rounded-xl bg-muted" />
            <div className="h-56 rounded-xl bg-muted" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-56 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
