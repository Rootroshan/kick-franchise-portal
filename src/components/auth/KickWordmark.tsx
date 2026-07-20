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
      // brightness-0 forces every non-transparent pixel to black, so the mark
      // renders black regardless of the colour baked into the PNG (the source
      // asset is white, which would vanish on this light background).
      className={`h-auto w-[150px] brightness-0 sm:w-[187px] ${className}`}
    />
  );
}
