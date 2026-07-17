import { Construction } from "lucide-react";

/** Honest placeholder for admin sections whose full page isn't built yet.
 *  Keeps sidebar nav from dead-ending while the feature is in progress. */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Construction className="h-6 w-6 text-status-warning" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{note ?? "This section is being built. The backend and data model already exist — the admin screen is next."}</p>
    </div>
  );
}
