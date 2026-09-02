"use client";

import { CreditCard, RefreshCw } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  className?: string;
  variant?: "primary" | "banner";
};

export function RetryPaymentButton({ orderId, className, variant = "primary" }: Props) {
  const retryHref = `/checkout?orderId=${orderId}`;

  if (variant === "banner") {
    return (
      <Link
        href={retryHref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700",
          className
        )}
      >
        <CreditCard className="h-4 w-4" />
        Retry Payment
      </Link>
    );
  }

  return (
    <Link
      href={retryHref}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600",
        className
      )}
    >
      <RefreshCw className="h-4 w-4" />
      Retry Payment
    </Link>
  );
}
