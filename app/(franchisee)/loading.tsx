import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

// Store portal route-transition loader.
export default function Loading() {
  return <FullScreenLoader message="Loading your store portal…" />;
}
