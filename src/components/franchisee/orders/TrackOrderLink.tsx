import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Opens the carrier tracking page in a new tab. `href` is always built
 * server-side from the carrier allowlist templates in lib/orderStatus.ts —
 * this component never receives a user-supplied URL.
 */
export function TrackOrderLink({ href, className, label = "Track Order" }: { href: string; className?: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline", className)}
    >
      {label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
