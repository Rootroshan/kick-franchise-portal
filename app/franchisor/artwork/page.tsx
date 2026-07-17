import { redirect } from "next/navigation";

// Nav uses /franchisor/artwork; the existing Artwork Hub implementation lives
// at /franchisor/assets. Redirect so both paths resolve.
export default function ArtworkRedirect() {
  redirect("/franchisor/assets");
}
