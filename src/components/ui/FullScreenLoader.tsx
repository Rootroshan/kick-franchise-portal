import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable full-screen brand loader: the Kick mark (Lucide ShieldCheck, the
 * same logo used in the app shells) with a subtle fade/scale pulse, a rotating
 * ring around it, and a loading message. Pure CSS/Tailwind — no libraries,
 * GIFs, or images. Honours prefers-reduced-motion (animations disabled via the
 * `motion-reduce:` variants → static, still-legible state).
 *
 * Use ONLY for initial route / auth loading. For dashboards use skeletons.
 */
export function FullScreenLoader({ message = "Loading…", className }: { message?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex min-h-[100dvh] w-full flex-col items-center justify-center gap-5 bg-app-bg px-6", className)}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Rotating ring */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-primary/15 border-t-primary motion-safe:animate-spin motion-reduce:border-t-primary/40"
        />
        {/* Logo mark with gentle fade/scale pulse */}
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary motion-safe:animate-pulse-scale">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>

      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  );
}
