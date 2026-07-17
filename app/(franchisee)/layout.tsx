import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { CartProvider } from "@/components/franchisee/CartContext";
import { BottomNav } from "@/components/franchisee/BottomNav";

export default async function FranchiseeLayout({ children }: { children: React.ReactNode }) {
  try {
    const ctx = await getRequestContext();
    if (ctx.role === "KICK_ADMIN") redirect("/admin");
    if (ctx.role === "FRANCHISOR_ADMIN") redirect("/franchisor/announcements");
  } catch (err) {
    if (err instanceof HttpError) {
      // 401 = not signed in. 404 = signed in but no tenant resolves for this
      // host / no membership yet (e.g. a freshly-signed-up user on the apex,
      // before a KICK_ADMIN/brand membership is granted). Both should land on
      // sign-in rather than a bare 404 — a redirect never grants access.
      if (err.status === 401 || err.status === 404) redirect("/sign-in");
      throw err; // 403 = genuinely forbidden membership — surface it, don't loop
    }
    throw err;
  }

  return (
    <CartProvider>
      <div className="mx-auto min-h-screen w-full max-w-md pb-16 sm:max-w-2xl md:max-w-4xl">
        <main className="px-4 py-4">{children}</main>
        <BottomNav />
      </div>
    </CartProvider>
  );
}
