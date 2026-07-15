import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { CartProvider } from "@/components/franchisee/CartContext";
import { BottomNav } from "@/components/franchisee/BottomNav";

export default async function FranchiseeLayout({ children }: { children: React.ReactNode }) {
  try {
    const ctx = await getRequestContext();
    if (ctx.role !== "FRANCHISEE_USER") {
      redirect("/"); // signed in, wrong role — no franchisee surface for them here
    }
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 401) redirect("/sign-in");
      redirect("/"); // 403/404 (wrong tenant, no membership) — nothing to show
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
