"use client";

import { memo, useMemo, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { QtyStepper } from "@/components/ui/QtyStepper";
import { useToast } from "@/components/ui/Toast";
import { FREE_SIZE_LABEL, getColorSlideIndex, isFreeSizeProduct } from "@/lib/product";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { cn, colorSwatch, formatCurrency } from "@/lib/utils";
import type { Product, ProductVariant } from "@/types";

function isBlankSize(size?: string) {
  const s = size?.trim() ?? "";
  return !s || s.toLowerCase() === "no size";
}

function findVariant(variants: ProductVariant[] | undefined, color: string, size: string) {
  return variants?.find(
    (v) =>
      v.color.toLowerCase() === color.toLowerCase() &&
      (v.size || "").toLowerCase() === (size || "").toLowerCase()
  );
}

function allColors(product: Product): string[] {
  if (product.variants?.length) {
    return [...new Set(product.variants.map((v) => v.color).filter(Boolean))];
  }
  return [];
}

/** Real sizes for a color (or all colors when `color` is empty). */
function sizesForColor(product: Product, color: string): string[] {
  if (!product.variants?.length) return [];
  const rows = color
    ? product.variants.filter((v) => v.color.toLowerCase() === color.toLowerCase())
    : product.variants;
  return [...new Set(rows.map((v) => v.size.trim()).filter((s) => !isBlankSize(s)))];
}

function pickSizeForColor(product: Product, color: string): string {
  const rows = product.variants?.filter((v) => v.color.toLowerCase() === color.toLowerCase()) ?? [];
  const inStockSized = rows.find((v) => v.qty > 0 && !isBlankSize(v.size));
  if (inStockSized) return inStockSized.size;
  const anySized = rows.find((v) => !isBlankSize(v.size));
  if (anySized) return anySized.size;
  return rows[0]?.size ?? "";
}

function defaultInStockVariant(product: Product): {
  color: string;
  size: string;
} {
  const inStockSized = product.variants?.find((v) => v.qty > 0 && !isBlankSize(v.size));
  if (inStockSized) return { color: inStockSized.color, size: inStockSized.size };

  const inStock = product.variants?.find((v) => v.qty > 0);
  if (inStock) return { color: inStock.color, size: inStock.size };

  const firstSized = product.variants?.find((v) => !isBlankSize(v.size));
  if (firstSized) return { color: firstSized.color, size: firstSized.size };

  const first = product.variants?.[0];
  if (first) return { color: first.color, size: first.size };

  return { color: "", size: "" };
}

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
  const colors = useMemo(() => allColors(product), [product]);
  const hasVariants = Boolean(product.variants?.length);
  const freeSize = isFreeSizeProduct(product);
  const initial = useMemo(() => defaultInStockVariant(product), [product]);

  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);

  // Sizes for the selected color only — this is what makes variant sizes visible/usable.
  const sizes = useMemo(() => sizesForColor(product, color), [product, color]);

  const selectedVariant = findVariant(product.variants, color, size);
  const totalStock = hasVariants
    ? (product.variants?.reduce((sum, v) => sum + v.qty, 0) ?? 0)
    : (product.stock ?? 0);
  const baseStock = hasVariants ? (selectedVariant?.qty ?? 0) : (product.stock ?? 0);

  // Units already in the bag for this exact variant — survives color/size switches.
  const specId = hasVariants ? selectedVariant?.id : undefined;
  const reservedQty = useCartStore((s) => {
    const line = s.items.find(
      (i) => i.productId === product.id && (i.specificationId || "") === (specId || "")
    );
    return line?.qty ?? 0;
  });
  const stock = Math.max(0, baseStock - reservedQty);

  const outOfStock = stock <= 0;
  const productFullyOut = totalStock <= 0;
  const invalidCombo = hasVariants && !selectedVariant;
  const needsSelection =
    hasVariants && ((colors.length > 0 && !color) || (sizes.length > 0 && isBlankSize(size)));

  const [qty, setQty] = useState(outOfStock ? 0 : 1);
  const selectedQty = outOfStock ? 0 : Math.min(Math.max(1, qty), stock);
  const addItem = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const { toast } = useToast();
  const slides = useMemo(() => {
    if (product.images?.length) return product.images;
    return [{ url: product.imageUrl, color: undefined as string | undefined }];
  }, [product.images, product.imageUrl]);
  const slideIndex = useMemo(
    () => getColorSlideIndex(slides, colors, color),
    [slides, colors, color]
  );

  function selectColor(nextColor: string) {
    setColor(nextColor);
    setSize(pickSizeForColor(product, nextColor));
  }

  return (
    <article className="flex h-full flex-col rounded-[7px] border border-[#e5e7eb] bg-white shadow-sm">
      <div className="relative aspect-square w-full overflow-hidden rounded-t-[7px] bg-[#eef1f4]">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {slides.map((img, i) => (
            <div
              key={`${img.url}-${img.color ?? "global"}-${i}`}
              className="relative h-full w-full shrink-0"
            >
              <Image
                src={img.url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            </div>
          ))}
        </div>
        {productFullyOut || outOfStock || invalidCombo ? (
          <span className="absolute right-2 top-2 z-10 rounded-xs bg-status-error-fg px-2 py-1 text-[11px] font-semibold text-white">
            Out Of Stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-between px-2 pb-2 pt-2">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-5 text-neutral-900">
          {product.name}
        </h3>

        <p className="mt-2 text-[13px] leading-none">
          <span className="text-[#6b7280]">Price: </span>
          <span className="font-bold tabular-nums text-brand-500">
            {formatCurrency(product.price)}
          </span>
        </p>

        {freeSize ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex h-6 items-center rounded-[3px] border border-neutral-900 bg-neutral-900 px-2 text-[11px] font-medium uppercase text-white">
              {FREE_SIZE_LABEL}
            </span>
            <p className="rounded-md border border-neutral-muted px-2 py-1 text-[12px] font-bold leading-none tabular-nums text-neutral-muted">
              {outOfStock ? "0 in stock" : `${stock} in stock`}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex min-h-4 flex-wrap items-center gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select ${c}`}
                  aria-pressed={color === c}
                  onClick={() => selectColor(c)}
                  className={cn(
                    "h-4 w-4 rounded-full border border-[#d9dee7] ring-offset-1",
                    color === c && "ring-1 ring-brand-500"
                  )}
                  style={{ backgroundColor: colorSwatch(c) }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-1.5">
              <div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {sizes.length ? (
                  sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={size === s}
                      onClick={() => setSize(s)}
                      className={cn(
                        "h-6 min-w-5 rounded-[3px] border border-[#e1e5eb] px-2 text-[11px] font-medium uppercase text-neutral-900 sm:min-w-7",
                        size === s && "border-neutral-900 bg-neutral-900 text-white"
                      )}
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  <span className="inline-flex h-6 items-center rounded-[3px] border border-neutral-900 bg-neutral-900 px-1 text-[11px] font-medium uppercase text-white sm:px-2">
                    {FREE_SIZE_LABEL}
                  </span>
                )}
              </div>
              <p className="shrink-0 rounded-md border border-neutral-muted px-2 py-1 text-[12px] font-bold leading-none tabular-nums text-neutral-muted">
                {invalidCombo || outOfStock ? "0 in stock" : `${stock} in stock`}
              </p>
            </div>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <QtyStepper
            value={selectedQty}
            min={outOfStock ? 0 : 1}
            max={Math.max(0, stock)}
            onChange={setQty}
          />
          <button
            type="button"
            disabled={outOfStock || invalidCombo || needsSelection || selectedQty < 1}
            className="w-full rounded-[3px] bg-brand-500 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={async () => {
              if (!isAuthenticated) {
                router.push("/login");
                return;
              }
              if (selectedQty < 1) {
                toast.error("Quantity must be at least 1");
                return;
              }
              if (invalidCombo) {
                toast.error("That color and size combination is out of stock");
                return;
              }
              if (needsSelection) {
                toast.error(
                  colors.length && sizes.length
                    ? "Select a color and size"
                    : colors.length
                      ? "Select a color"
                      : "Select a size"
                );
                return;
              }
              const result = await addItem(product, selectedQty, {
                specificationId: selectedVariant?.id,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Added into cart");
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
});
