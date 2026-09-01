"use client";

import { User } from "lucide-react";

import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type UserAvatarProps = {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
};

/** OAuth profile photos (Facebook, Google, etc.) use native img — avoids next/image host config issues. */
export function UserAvatar({ name, image, size = 32, className }: UserAvatarProps) {
  const label = initials(name);

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party OAuth avatar URLs
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {label || <User className="h-4 w-4" />}
    </span>
  );
}
