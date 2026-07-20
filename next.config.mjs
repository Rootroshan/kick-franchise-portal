import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      // /login is the path people reach for and it is referenced in operator
      // docs; the actual page lives at /sign-in (which NextAuth's `pages.signIn`
      // and every middleware bounce also target). A redirect keeps one real
      // page instead of two that drift apart.
      { source: "/login", destination: "/sign-in", permanent: true },
      // Stores are managed inside their brand, so the standalone list is gone
      // from the sidebar. Redirect (not delete) so old bookmarks still land
      // somewhere useful. /admin/stores/[id] is untouched — deep links to a
      // specific store keep working.
      { source: "/admin/stores", destination: "/admin/brands", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

// withSentryConfig no-ops gracefully when SENTRY_AUTH_TOKEN/org/project are
// unset (e.g. local dev, CI without Sentry configured) — safe to always wrap.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
});
