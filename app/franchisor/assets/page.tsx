import { redirect } from "next/navigation";

// The Artwork Hub now lives at /franchisor/artwork. Keep this path working.
export default function AssetsRedirect() {
  redirect("/franchisor/artwork");
}
