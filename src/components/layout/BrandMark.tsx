"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tenant brand identity, everywhere the Store User side shows it:
 * - Valid logo → the logo ONLY (brand name as alt text, never beside it).
 * - No logo, or the logo URL fails to load → the brand name as text.
 * Never both together, never a broken-image icon, never an empty box.
 */
export function BrandMark({
  name,
  logoUrl,
  imgClassName,
  nameClassName,
}: {
  name: string;
  logoUrl?: string | null;
  /** Sizing for the logo image, e.g. "h-7 w-auto" (header) or "h-16 w-auto" (login). */
  imgClassName?: string;
  /** Styling for the text fallback. */
  nameClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const hasLogo = Boolean(logoUrl && logoUrl.trim().length > 0) && !failed;

  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- onError fallback needs a plain img; tenant logos are remote/unoptimized anyway
      <img
        src={logoUrl!}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("w-auto max-w-[180px] object-contain", imgClassName)}
      />
    );
  }

  return <span className={cn("truncate font-semibold", nameClassName)}>{name}</span>;
}
