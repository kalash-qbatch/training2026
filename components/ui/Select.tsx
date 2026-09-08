"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SelectOption, SelectProps } from "@/types";

export type { SelectOption };

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_GAP = 4;
const ITEM_HEIGHT = 36;
const LIST_PADDING = 8;

function getClipBounds(el: HTMLElement) {
  let parent = el.parentElement;
  let top = 0;
  let bottom = window.innerHeight;

  while (parent) {
    const { overflow, overflowY } = getComputedStyle(parent);
    if (/(auto|scroll|hidden|overlay)/.test(overflow + overflowY)) {
      const rect = parent.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
    parent = parent.parentElement;
  }

  return { top, bottom };
}

function getDropdownPlacement(trigger: HTMLElement, listHeight: number) {
  const rect = trigger.getBoundingClientRect();
  const clip = getClipBounds(trigger);
  const spaceBelow = clip.bottom - rect.bottom - DROPDOWN_GAP;
  const spaceAbove = rect.top - clip.top - DROPDOWN_GAP;
  const needed = Math.min(listHeight, DROPDOWN_MAX_HEIGHT);
  const openUpward = spaceBelow < needed && spaceAbove > spaceBelow;
  const available = openUpward ? spaceAbove : spaceBelow;

  return {
    openUpward,
    maxHeight: Math.max(0, Math.min(DROPDOWN_MAX_HEIGHT, available)),
  };
}

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
  const [openUpward, setOpenUpward] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState(DROPDOWN_MAX_HEIGHT);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  const updatePlacement = () => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const estimated = listRef.current?.scrollHeight ?? options.length * ITEM_HEIGHT + LIST_PADDING;
    const { openUpward: nextOpenUpward, maxHeight } = getDropdownPlacement(trigger, estimated);
    setOpenUpward(nextOpenUpward);
    setListMaxHeight(maxHeight);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
  }, [open, options]);

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
    window.addEventListener("resize", updatePlacement);

    const overflowParent = rootRef.current?.parentElement
      ? (() => {
          let parent: HTMLElement | null = rootRef.current!.parentElement;
          while (parent) {
            const { overflow, overflowY } = getComputedStyle(parent);
            if (/(auto|scroll|hidden|overlay)/.test(overflow + overflowY)) return parent;
            parent = parent.parentElement;
          }
          return null;
        })()
      : null;
    overflowParent?.addEventListener("scroll", updatePlacement, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePlacement);
      overflowParent?.removeEventListener("scroll", updatePlacement);
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
        onClick={() => {
          if (!open) updatePlacement();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) updatePlacement();
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
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-50 overflow-auto rounded-lg border border-[#e5e7eb] bg-white pt-1 shadow-lg",
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{ maxHeight: listMaxHeight }}
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
