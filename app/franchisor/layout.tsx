import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { isDevBypassEnabled } from "@/lib/devBypass";
import { PushOptInBanner } from "@/components/franchisor/PushOptInBanner";

const NAV = [
  { href: "/franchisor/announcements", label: "Announcements" },
  { href: "/franchisor/assets", label: "Artwork Hub" },
  { href: "/franchisor/tasks", label: "Tasks" },
  { href: "/franchisor/onboarding", label: "Onboarding" },
];

export default async function FranchisorLayout({ children }: { children: React.ReactNode }) {
  try {
    const ctx = await getRequestContext();
    if (ctx.role !== "FRANCHISOR_ADMIN") {
      redirect("/");
    }
  } catch (err) {
    if (err instanceof HttpError) {
      redirect("/");
    }
    throw err;
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-border bg-card lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-4 lg:flex-col lg:items-stretch lg:gap-4">
          <div className="text-lg font-bold">Franchisor</div>
          <nav className="flex flex-wrap gap-1 lg:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block lg:pt-4">
            {!isDevBypassEnabled() && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <PushOptInBanner />
        {children}
      </main>
    </div>
  );
}
