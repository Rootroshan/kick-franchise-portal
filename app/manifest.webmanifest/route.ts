import { headers } from "next/headers";
import { resolveTenantFromHost } from "@/server/modules/identity/tenantResolution";
import { parseTenantTheme } from "@/lib/theme";

/**
 * Dynamic per-tenant PWA manifest so each brand's installed app shows its
 * own name/colors. Falls back to generic Kick branding if the tenant can't
 * be resolved (e.g. apex domain before any tenant DNS is configured).
 */
export async function GET() {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? hdrs.get("x-kick-host") ?? "";
  const tenant = await resolveTenantFromHost(host).catch(() => null);
  const theme = parseTenantTheme(tenant?.theme ?? {});

  const manifest = {
    name: tenant ? `${tenant.name} Portal` : "Kick Franchise Portal",
    short_name: tenant ? tenant.name : "Kick Portal",
    description: "Franchise operations, ordering, and communication platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: theme.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
