"use client";

import { useEffect, useRef, useState } from "react";

import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SelectOption, SelectProps } from "@/types";

export type { SelectOption };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  prefix,
  disabled,
  className,
  ariaLabel,
  labelClass,
  buttonClass,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-10 w-full items-center text justify-between gap-2 rounded-md border border-neutral-border bg-white px-3 text-left text-[13px] text-neutral-text outline-none transition focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-[#2563EB]",
          className
        )}
      >
        <span className="truncate">
          {prefix ? <span className="text-[#8E94A9] uppercase">{prefix} </span> : null}
          {selected ? (
            <span className={cn(selected.accent && "text-[#2563EB] uppercase")}>
              {selected.label}
            </span>
          ) : (
            <span className="text-neutral-muted uppercase">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#6b7280] transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 pb-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                className={cn(labelClass, opt.className)}
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-[#f3f4f6]",
                    isSelected ? "bg-brand-50 font-medium text-[#2563EB]" : "text-neutral-text",
                    opt.accent && "font-medium text-[#2563EB]",
                    opt.disabled &&
                      "cursor-not-allowed text-neutral-300 hover:bg-transparent hover:text-neutral-300",
                    buttonClass
                  )}
                >
                  <span className="truncate uppercase">{opt.label}</span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#2563EB]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
