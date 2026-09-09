import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function AuthCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-neutral-border/60 bg-neutral-surface p-6 shadow-[0_12px_40px_rgba(16,24,40,0.08)] sm:p-7 max-[999px]:border-white/40 max-[999px]:shadow-[0_20px_50px_rgba(0,0,0,0.28)]",
        className
      )}
      {...props}
    />
  );
}
