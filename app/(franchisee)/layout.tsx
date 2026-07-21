import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { withTenant } from "@/server/db/withTenant";
import { parseTenantTheme } from "@/lib/theme";
import { getStoreNotifications } from "@/server/modules/notifications/store";
import { CartProvider } from "@/components/franchisee/CartContext";
import { BottomNav } from "@/components/franchisee/BottomNav";
import { TopBar } from "@/components/franchisee/TopBar";

export default async function FranchiseeLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getRequestContext();
    if (ctx.role === "KICK_ADMIN") redirect("/admin");
    if (ctx.role === "FRANCHISOR_ADMIN") redirect("/franchisor/dashboard");
  } catch (err) {
    if (err instanceof HttpError) {
      // 401 = not signed in. 404 = signed in but no tenant resolves for this
      // host / no membership yet (e.g. a freshly-signed-up user on the apex,
      // before a KICK_ADMIN/brand membership is granted). Both should land on
      // the Store User login for this tenant, never the KICK_ADMIN /sign-in —
      // a redirect never grants access.
      if (err.status === 401 || err.status === 404) redirect("/store-login");
      throw err; // 403 = genuinely forbidden membership — surface it, don't loop
    }
    throw err;
  }

  const tenantId = ctx.tenantId;
  const [brand, unreadCount] = await Promise.all([
    tenantId
      ? withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, theme: true } }))
      : Promise.resolve(null),
    // Reuses the same signal set the store's own /notifications page reads —
    // no separate count query, no drift between the badge and the list.
    getStoreNotifications(ctx).then((n) => n.length).catch(() => 0),
  ]);
  const theme = parseTenantTheme(brand?.theme);

  return (
    <CartProvider>
      <div className="mx-auto min-h-screen w-full max-w-md pb-16 sm:max-w-2xl md:max-w-4xl">
        <TopBar brandName={brand?.name ?? "Store Portal"} logoUrl={theme.logoUrl} unreadCount={unreadCount} />
        <main className="px-4 py-4">{children}</main>
        <BottomNav />
      </div>
    </CartProvider>
  );
}
