"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import type { CartItem } from "@/types";
import { colorSwatch, formatCurrency } from "@/lib/utils";
import {
  FREE_SIZE_LABEL,
  formatLineColor,
  formatLineSize,
  isFreeSizeLine,
} from "@/lib/product";
import { QtyStepper } from "@/components/ui/QtyStepper";

type Props = {
  item: CartItem;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  variant: "table" | "card";
};

export function CartLineItem({
  item,
  selected,
  onSelect,
  onQtyChange,
  onRemove,
  variant,
}: Props) {
  const lineTotal = item.price * item.qty;

  if (variant === "card") {
    return (
      <li className="rounded-lg border border-neutral-border bg-neutral-surface p-4">
        <div className="flex gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-neutral-border text-brand-500"
            aria-label={`Select ${item.name}`}
          />
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-bg">
            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="64px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-neutral-text">{item.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-muted">
              {isFreeSizeLine(item.color, item.size) ? (
                <span>{FREE_SIZE_LABEL}</span>
              ) : (
                <>
                  {item.color ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full border border-neutral-border"
                        style={{ backgroundColor: colorSwatch(item.color) }}
                      />
                      {item.color}
                    </span>
                  ) : null}
                  {item.size ? <span>Size {item.size}</span> : null}
                </>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold tabular-nums text-brand-600">
              {formatCurrency(lineTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="self-start rounded-md p-2 text-[#EF4444] hover:bg-red-50"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 pl-7">
          <QtyStepper value={item.qty} onChange={onQtyChange} max={item.stock} />
          <p className="text-xs text-neutral-muted">
            {formatCurrency(item.price)} each
          </p>
        </div>
      </li>
    );
  }

  return (
    <tr className="border-b border-neutral-border">
      <td className="py-4 pr-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-border text-brand-500"
          aria-label={`Select ${item.name}`}
        />
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-bg">
            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="56px" />
          </div>
          <p className="line-clamp-2 max-w-[280px] text-sm font-medium text-neutral-text">
            {item.name}
          </p>
        </div>
      </td>
      <td className="py-4">
        {item.color ? (
          <span className="inline-flex items-center gap-2 text-sm text-neutral-text">
            <span
              className="h-3.5 w-3.5 rounded-full border border-neutral-border"
              style={{ backgroundColor: colorSwatch(item.color) }}
            />
            {item.color}
          </span>
        ) : (
          <span className="text-sm text-neutral-muted">{formatLineColor(item.color)}</span>
        )}
      </td>
      <td className="py-4 text-sm text-neutral-text">
        {formatLineSize(item.size, item.color)}
      </td>
      <td className="py-4">
        <QtyStepper value={item.qty} onChange={onQtyChange} max={item.stock} />
      </td>
      <td className="py-4 text-sm tabular-nums text-neutral-text">
        {formatCurrency(item.price)}
      </td>
      <td className="py-4 text-sm font-semibold tabular-nums text-neutral-text">
        {formatCurrency(lineTotal)}
      </td>
      <td className="py-4 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-2 text-[#EF4444] hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
