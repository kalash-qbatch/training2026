"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SelectOption, SelectProps } from "@/types";

export type { SelectOption };

const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_GAP = 4;
const ITEM_HEIGHT = 36;
const LIST_PADDING = 8;
const SEARCH_HEIGHT = 44;

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
  searchable = false,
  searchPlaceholder = "Search…",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState(DROPDOWN_MAX_HEIGHT);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected =
    options.find((o) => o.value === value) ||
    (value
      ? options.find((o) => o.value.toLowerCase() === String(value).toLowerCase())
      : undefined);
  const displayLabel = selected?.label ?? (value ? String(value) : "");

  const { regularOptions, stickyOptions } = useMemo(() => {
    const regular: SelectOption[] = [];
    const sticky: SelectOption[] = [];
    for (const opt of options) {
      if (opt.accent || opt.className?.includes("sticky")) sticky.push(opt);
      else regular.push(opt);
    }
    return { regularOptions: regular, stickyOptions: sticky };
  }, [options]);

  const filteredRegular = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return regularOptions;
    return regularOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [regularOptions, query, searchable]);

  const visibleOptions = useMemo(
    () => [...filteredRegular, ...stickyOptions],
    [filteredRegular, stickyOptions]
  );

  const updatePlacement = () => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const searchExtra = searchable ? SEARCH_HEIGHT : 0;
    const estimated =
      (panelRef.current?.scrollHeight ??
        visibleOptions.length * ITEM_HEIGHT + LIST_PADDING + searchExtra) ||
      ITEM_HEIGHT + LIST_PADDING + searchExtra;
    const { openUpward: nextOpenUpward, maxHeight } = getDropdownPlacement(trigger, estimated);
    setOpenUpward(nextOpenUpward);
    setListMaxHeight(maxHeight);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
  }, [open, visibleOptions, searchable, query]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setQuery("");
      }, 100);
      return;
    }

    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }

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
  }, [open, searchable]);

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
          {displayLabel ? (
            <span className={cn(selected?.accent && "text-[#2563EB] uppercase")}>
              {displayLabel}
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
        <div
          ref={panelRef}
          className={cn(
            "absolute left-0 right-0 z-50 flex flex-col overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-lg",
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{ maxHeight: listMaxHeight }}
        >
          {searchable ? (
            <div className="shrink-0 border-b border-[#e5e7eb] p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") setOpen(false);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-md border border-[#e5e7eb] bg-white py-1.5 pl-8 pr-3 text-[13px] text-neutral-text outline-none placeholder:text-[#9ca3af] focus:border-[#2563EB]"
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>
          ) : null}

          <ul role="listbox" className="min-h-0 flex-1 overflow-auto py-1">
            {filteredRegular.length === 0 && stickyOptions.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-neutral-muted">No results</li>
            ) : null}
            {visibleOptions.map((opt) => {
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
        </div>
      ) : null}
    </div>
  );
}
