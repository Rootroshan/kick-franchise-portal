import Image from "next/image";

/**
 * KICK Media Group logo (public/kick-logo.png, 187x80 transparent PNG).
 *
 * Width/height match the intrinsic size so Next can reserve the space and the
 * page does not shift as it loads. `priority` because it sits above the fold on
 * the sign-in page — without it Next lazy-loads and the mark pops in late.
 */
export function KickWordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/kick-logo.png"
      alt="KICK Media Group"
      width={187}
      height={80}
      priority
      className={`h-auto w-[150px] sm:w-[187px] ${className}`}
    />
  );
}
