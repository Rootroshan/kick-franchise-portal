import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small inline loader for buttons and in-flight actions (form submit, saving,
 * uploading, filtering, checkout). Lucide spinner; respects reduced-motion
 * (the spin stops but the icon + label stay visible). Pair with a disabled
 * button and real pending state (useFormStatus / useTransition) — never a
 * fake setTimeout.
 */
export function InlineLoader({ label, className, size = 16 }: { label?: string; className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} role="status" aria-live="polite">
      <Loader2 className="motion-safe:animate-spin" style={{ width: size, height: size }} aria-hidden="true" />
      {label && <span>{label}</span>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
