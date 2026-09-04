import { PackageOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "./Button";

export function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
  ctaPrefetch = true,
}: {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  ctaPrefetch?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-border bg-neutral-surface px-6 py-16 text-center">
      <PackageOpen className="mb-3 h-10 w-10 text-neutral-muted" aria-hidden />
      <h2 className="text-base font-semibold text-neutral-text">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-neutral-muted">{description}</p>
      ) : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} prefetch={ctaPrefetch} className="mt-5 w-full max-w-xs">
          <Button type="button">{ctaLabel}</Button>
        </Link>
      ) : null}
    </div>
  );
}
