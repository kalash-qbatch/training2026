"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QtyStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
};

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  className,
}: QtyStepperProps) {
  const cell =
    "flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-[#d0d5dd] bg-white text-[13px]";
  const atMin = value <= min;
  const atMax = max != null && value >= max;

  return (
    <div className={cn("inline-flex items-center gap-0", className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        className={cn(
          cell,
          "text-brand-500 hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-40"
        )}
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span
        className={cn(cell, "-mx-px font-medium tabular-nums text-[#333333]")}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={cn(
          cell,
          "text-brand-500 hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-40"
        )}
        disabled={atMax}
        onClick={() => {
          const next = value + 1;
          onChange(max != null ? Math.min(max, next) : next);
        }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
