import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { CartProvider } from "@/components/franchisee/CartContext";
import { BottomNav } from "@/components/franchisee/BottomNav";

export default async function FranchiseeLayout({ children }: { children: React.ReactNode }) {
  try {
    const ctx = await getRequestContext();
    if (ctx.role === "KICK_ADMIN") redirect("/admin/tenants");
    if (ctx.role === "FRANCHISOR_ADMIN") redirect("/franchisor/announcements");
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 401) redirect("/sign-in");
      throw err; // 403/404 here means genuinely broken membership — surface it, don't loop
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
