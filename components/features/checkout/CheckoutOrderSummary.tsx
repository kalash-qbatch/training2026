"use client";

import { useState } from "react";

import { ChevronDown, Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import Image from "next/image";

import { formatLineSize } from "@/lib/product";
import { cn, colorSwatch, formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/types";

function itemImage(item: CartItem) {
  if (!item.color || !item.images?.length) return item.imageUrl;
  const match = item.images.find((img) => img.color?.toLowerCase() === item.color?.toLowerCase());
  return match?.url ?? item.imageUrl;
}

export function CheckoutOrderSummary({
  items,
  subtotal,
  tax,
  total,
}: {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const count = items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-border/80 bg-white shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
      <div className="bg-brand-500 px-4 py-4 text-white sm:px-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/80">
          Total to pay
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{formatCurrency(total)}</p>
        <p className="mt-1 text-xs text-white/75">
          {count} {count === 1 ? "item" : "items"} · includes {formatCurrency(tax)} tax
        </p>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-text">
          <ShoppingBag className="h-4 w-4 text-brand-600" strokeWidth={1.75} />
          {open ? "Hide order details" : "Show order details"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-neutral-muted transition-transform", open && "rotate-180")}
        />
      </button>

      <div className={cn("border-t border-neutral-100 lg:block", open ? "block" : "hidden")}>
        <ul className="max-h-52 divide-y divide-neutral-100 overflow-y-auto pt-1.5 sm:max-h-64 lg:max-h-72">
          {items.map((item) => {
            const src = itemImage(item);
            const key = item.id ?? `${item.productId}-${item.specificationId ?? "default"}`;
            return (
              <li key={key} className="flex gap-3 px-4 py-3 sm:px-5">
                <div className="relative h-14 w-14 shrink-0">
                  <div className="relative h-full w-full overflow-hidden rounded-lg bg-neutral-bg ring-1 ring-black/5">
                    {src ? (
                      <Image src={src} alt={item.name} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-muted">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-text px-1 text-[10px] font-semibold text-white">
                    {item.qty}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-neutral-text">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-muted">
                    {item.color ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full border border-neutral-border"
                          style={{ backgroundColor: colorSwatch(item.color) }}
                        />
                        {item.color}
                      </span>
                    ) : null}
                    {item.color && item.size ? " · " : null}
                    {item.size ? `Size ${formatLineSize(item.size)}` : null}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-text">
                  {formatCurrency(item.price * item.qty)}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 border-t border-neutral-100 px-4 py-4 sm:px-5">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-muted">Subtotal</span>
            <span className="tabular-nums text-neutral-text">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-muted">Tax</span>
            <span className="tabular-nums text-neutral-text">{formatCurrency(tax)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-neutral-200 pt-3">
            <span className="text-sm font-semibold text-neutral-text">Total</span>
            <span className="text-lg font-bold tabular-nums text-brand-600">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden items-center justify-center gap-4 border-t border-neutral-100 bg-neutral-bg/70 px-4 py-3 text-[11px] text-neutral-muted lg:flex">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> SSL Secure
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Encrypted checkout
        </span>
      </div>
    </div>
  );
}
