import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-border/80 bg-neutral-surface p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:p-8",
        className
      )}
      {...props}
    />
  );
}
