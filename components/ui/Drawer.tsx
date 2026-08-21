"use client";

import { useEffect, useId, useRef } from "react";

import { ArrowLeft } from "lucide-react";

import { useOverlayTransition } from "@/hooks/useOverlayTransition";
import { cn } from "@/lib/utils";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Title row click handler. Defaults to onClose. Use to go back one step. */
  onBack?: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  widthClassName?: string;
};

export function Drawer({
  open,
  onClose,
  onBack,
  title,
  children,
  className,
  widthClassName = "max-w-[560px]",
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const handleBack = onBack ?? onClose;
  const { present, visible } = useOverlayTransition(open, 300);

  useEffect(() => {
    if (!present) return;
    const previous = document.activeElement as HTMLElement | null;
    if (visible) panelRef.current?.focus();
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Always unlock scroll on unmount — never restore a stale 'hidden' value
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [present, visible, onClose]);

  if (!present) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close drawer"
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex h-full w-full flex-col border-l border-[#c5d6f5] bg-white shadow-xl focus:outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible ? "translate-x-0" : "translate-x-full",
          widthClassName,
          className
        )}
      >
        <div className="flex items-center gap-2 border-b border-[#e8edf5] px-5 py-4">
          <button
            type="button"
            id={titleId}
            onClick={handleBack}
            className="inline-flex cursor-pointer items-center gap-2 text-[15px] font-semibold text-[#2563EB] transition hover:text-[#1e6aef]"
            aria-label={`Back from ${title}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            {title}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
