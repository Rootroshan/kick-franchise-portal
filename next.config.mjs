import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // argon2 loads its native .node binary at runtime via node-gyp-build
    // based on platform detection, which Next's output file tracing can't
    // follow statically — it was silently dropping the prebuild from every
    // serverless function bundle, causing "No native build was found" in
    // production (while working locally, where node_modules is untraced and
    // complete). Next 14.2's outputFileTracingIncludes lives under
    // `experimental`, not top-level (that move happened in a later release).
    outputFileTracingIncludes: {
      "/app/api/auth/[...nextauth]": ["node_modules/argon2/**/*"],
      "/app/sign-out": ["node_modules/argon2/**/*"],
      "/app/sign-in/[[...sign-in]]": ["node_modules/argon2/**/*"],
      "/app/forgot-password": ["node_modules/argon2/**/*"],
      "/app/admin/users": ["node_modules/argon2/**/*"],
      "/app/admin/roles": ["node_modules/argon2/**/*"],
      "/app/admin/brands/[slug]": ["node_modules/argon2/**/*"],
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
