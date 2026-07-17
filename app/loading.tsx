import { Spinner } from "@/components/ui/spinner";

// Shown automatically by Next.js while any route's server components fetch
// their data. Centered full-screen.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
