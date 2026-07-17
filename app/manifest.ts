import type { MetadataRoute } from "next";

/**
 * PWA manifest, served at /manifest.webmanifest (referenced by app/layout.tsx).
 * The store portal is the installable surface for franchisee users. Icons use
 * a maskable SVG; per-brand icons are a follow-up (see README assumptions).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kick Store Portal",
    short_name: "Kick Store",
    description: "Your store's brand hub — announcements, tasks, onboarding, artwork and ordering.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111827",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
