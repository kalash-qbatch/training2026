"use client";

import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-end gap-1.5 text-[13px]", className)}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="cursor-pointer rounded px-2.5 py-1 text-neutral-muted hover:text-neutral-text disabled:pointer-events-none disabled:opacity-40"
      >
        Previous
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "min-w-7 cursor-pointer rounded px-2 py-1 transition-colors",
            p === page
              ? "font-bold text-[#2563EB]"
              : "text-neutral-muted hover:text-neutral-text"
          )}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="cursor-pointer rounded px-2.5 py-1 text-neutral-muted hover:text-neutral-text disabled:pointer-events-none disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
