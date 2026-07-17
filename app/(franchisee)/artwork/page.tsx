import { redirect } from "next/navigation";

// The franchisee Artwork Hub is implemented at /assets (grid + signed 5-min
// downloads). Keep the spec's /artwork path working by redirecting to it.
export default function ArtworkRedirect() {
  redirect("/assets");
}
