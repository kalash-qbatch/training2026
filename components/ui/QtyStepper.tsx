"use client";

import { useEffect, useState } from "react";

import { Minus, Plus } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type QtyStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
};

export function QtyStepper({ value, onChange, min = 1, max, className }: QtyStepperProps) {
  const { toast } = useToast();
  const [local, setLocal] = useState(value);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setLocal(value);
    }, 0);
  }, [value]);

  const display = draft ?? local;
  const cell =
    "flex h-8.5 w-8.5 shrink-0 items-center justify-center border border-neutral-border bg-white text-[13px]";
  const atMin = local <= min;
  const atMax = max != null && local >= max;

  function apply(next: number) {
    if (max != null && next > max) {
      toast.error(`Only ${max} in stock`);
      setLocal(max);
      onChange(max);
      return max;
    }
    const clamped = Math.max(min, next);
    setLocal(clamped);
    onChange(clamped);
    return clamped;
  }

  function handleInputChange(raw: string) {
    setDraft(raw);
    if (raw.trim() === "" || raw === "-") return;
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    if (max != null && next > max) {
      toast.error(`Only ${max} in stock`);
      setDraft(String(max));
      setLocal(max);
      onChange(max);
      return;
    }
    if (next < min) {
      toast.error("Quantity must be at least 1");
      setDraft(String(min));
      setLocal(min);
      onChange(min);
      return;
    }
    setLocal(next);
    onChange(next);
  }

  function handleBlur() {
    if (draft == null) return;
    const next = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(next)) {
      setLocal(min);
      onChange(min);
    } else {
      apply(next);
    }
    setDraft(null);
  }

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
        onClick={() => {
          setDraft(null);
          apply(local - 1);
        }}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={display}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
            e.preventDefault();
          }
        }}
        className="font-medium tabular-nums text-neutral-900 px-2 h-8.5 w-15.5 shrink-0 items-center text-center justify-center border border-neutral-border bg-white text-[13px]"
        aria-live="polite"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className={cn(
          cell,
          "text-brand-500 hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-40"
        )}
        disabled={atMax}
        onClick={() => {
          setDraft(null);
          apply(local + 1);
        }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
