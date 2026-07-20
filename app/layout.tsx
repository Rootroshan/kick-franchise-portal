import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/styles/globals.css";
import { resolveTenantFromHost } from "@/server/modules/identity/tenantResolution";
import { parseTenantTheme, themeToCssVariables } from "@/lib/theme";
import { PosthogProvider } from "@/components/analytics/PosthogProvider";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Kick Franchise Portal",
  description: "Franchise operations, ordering, and communication platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kick Portal",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#111827",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? hdrs.get("x-kick-host") ?? "";
  const tenant = await resolveTenantFromHost(host).catch(() => null);
  const theme = parseTenantTheme(tenant?.theme ?? {});

  // NextAuth needs no client provider here: server components read the session
  // via auth(), and the few client components that need it call useSession()
  // against /api/auth, which requires no wrapper.
  return (
    <html lang="en">
      <head>
        <style>{`:root { ${themeToCssVariables(theme)} }`}</style>
      </head>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--tenant-font)" }}>
        <PosthogProvider>{children}</PosthogProvider>
        <ServiceWorkerRegister />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
