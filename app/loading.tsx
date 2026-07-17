import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

// Root route-transition loader (also covers the sign-in / auth area).
export default function Loading() {
  return <FullScreenLoader message="Verifying secure access…" />;
}
