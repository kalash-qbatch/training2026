"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SelectOption, SelectProps } from "@/types";

export type { SelectOption };

const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_GAP = 4;
const ITEM_HEIGHT = 36;
const LIST_PADDING = 8;
const SEARCH_HEIGHT = 44;
const VIEWPORT_PAD = 8;

type PanelStyle = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

function estimateListHeight(optionCount: number, searchable: boolean) {
  return optionCount * ITEM_HEIGHT + LIST_PADDING + (searchable ? SEARCH_HEIGHT : 0);
}

function getFixedPlacement(trigger: HTMLElement, listHeight: number): PanelStyle {
  const rect = trigger.getBoundingClientRect();
  const needed = Math.min(listHeight, DROPDOWN_MAX_HEIGHT);
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_PAD;
  const spaceAbove = rect.top - DROPDOWN_GAP - VIEWPORT_PAD;
  const openUpward = spaceBelow < needed && spaceAbove > spaceBelow;
  const available = openUpward ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(ITEM_HEIGHT + LIST_PADDING, Math.min(DROPDOWN_MAX_HEIGHT, available));

  return {
    openUpward,
    maxHeight,
    left: rect.left,
    width: rect.width,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + DROPDOWN_GAP }
      : { top: rect.bottom + DROPDOWN_GAP }),
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
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);
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

    const estimated =
      (panelRef.current?.scrollHeight ?? estimateListHeight(visibleOptions.length, searchable)) ||
      ITEM_HEIGHT + LIST_PADDING;
    setPanelStyle(getFixedPlacement(trigger, estimated));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placement uses latest visible options via closure
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
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchable]);

  const canPortal = typeof document !== "undefined";

  const panel =
    open && canPortal && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-80 flex flex-col overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
            style={{
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: panelStyle.maxHeight,
              top: panelStyle.top,
              bottom: panelStyle.bottom,
            }}
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
          </div>,
          document.body
        )
      : null;

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
      {panel}
    </div>
  );
}
