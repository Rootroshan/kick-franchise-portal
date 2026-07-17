import { Spinner } from "@/components/ui/spinner";

// Scoped to the franchisee section so the bottom nav stays visible while the
// page's content loads.
export default function Loading() {
  return <Spinner />;
}
