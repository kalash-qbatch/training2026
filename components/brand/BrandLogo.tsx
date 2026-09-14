import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/images/bhai-ka-store-logo.jpg";
export const BRAND_NAME = "Bhai ka Store";

type BrandLogoProps = {
  href?: string;
  /** Visual size preset */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Show brand name text next to the mark (optional). */
  showWordmark?: boolean;
  priority?: boolean;
};

const SIZE = {
  sm: { box: "h-9 w-9", img: 36 },
  md: { box: "h-11 w-11", img: 44 },
  lg: { box: "h-16 w-16", img: 64 },
} as const;

export function BrandLogo({
  href = "/products",
  size = "sm",
  className,
  showWordmark = false,
  priority = false,
}: BrandLogoProps) {
  const s = SIZE[size];

  const mark = (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-md ring-1 ring-black/10",
        s.box
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt={BRAND_NAME}
        width={s.img}
        height={s.img}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </span>
  );

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-neutral-text">
          {BRAND_NAME}
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex items-center transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      aria-label={BRAND_NAME}
    >
      {content}
    </Link>
  );
}
