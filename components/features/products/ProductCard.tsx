"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/types";
import { cn, colorSwatch, formatCurrency } from "@/lib/utils";
import {
  FREE_SIZE_LABEL,
  getColorSlideIndex,
  isFreeSizeProduct,
} from "@/lib/product";
import { useCartStore } from "@/lib/store/useCartStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useToast } from "@/components/ui/Toast";
import { QtyStepper } from "@/components/ui/QtyStepper";

function findVariant(
  variants: ProductVariant[] | undefined,
  color: string,
  size: string
) {
  return variants?.find(
    (v) =>
      v.color.toLowerCase() === color.toLowerCase() &&
      v.size.toLowerCase() === size.toLowerCase()
  );
}

function allColors(product: Product): string[] {
  if (product.variants?.length) {
    return [...new Set(product.variants.map((v) => v.color).filter(Boolean))];
  }
  return [];
}

function allSizes(product: Product): string[] {
  if (product.variants?.length) {
    return [...new Set(product.variants.map((v) => v.size).filter(Boolean))];
  }
  return [];
}

function defaultInStockVariant(product: Product): {
  color: string;
  size: string;
} {
  const inStock = product.variants?.find((v) => v.qty > 0);
  if (inStock) return { color: inStock.color, size: inStock.size };

  const first = product.variants?.[0];
  if (first) return { color: first.color, size: first.size };

  return { color: "", size: "" };
}

export function ProductCard({ product }: { product: Product }) {
  const colors = useMemo(() => allColors(product), [product]);
  const sizes = useMemo(() => allSizes(product), [product]);
  const hasVariants = Boolean(product.variants?.length);
  const freeSize = isFreeSizeProduct(product);
  

  // function getDefaultInStockVariant(product: Product) {
  //   const inStock = product.variants?.find((v) => v.qty > 0);
  
  //   if (inStock) {
  //     return {
  //       color: inStock.color,
  //       size: inStock.size,
  //     };
  //   }
  
  //   const first = product.variants?.[0];
  
  //   if (first) {
  //     return {
  //       color: first.color,
  //       size: first.size,
  //     };
  //   }
  
  //   return { color: "", size: "" };
  // }
  const [color, setColor] = useState(defaultInStockVariant(product).color);
  const [size, setSize] = useState(defaultInStockVariant(product).size);

  const selectedVariant = findVariant(product.variants, color, size);
  const totalStock = hasVariants
    ? (product.variants?.reduce((sum, v) => sum + v.qty, 0) ?? 0)
    : (product.stock ?? 0);
  const stock = hasVariants
    ? (selectedVariant?.qty ?? 0)
    : (product.stock ?? 0);
  const outOfStock = stock <= 0;
  const productFullyOut = totalStock <= 0;
  const invalidCombo = hasVariants && !selectedVariant;
  const needsSelection =
    hasVariants &&
    ((colors.length > 0 && !color) || (sizes.length > 0 && !size));

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

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[7px] border border-[#e5e7eb] bg-white shadow-sm">
      <div className="relative aspect-square w-full overflow-hidden bg-[#eef1f4]">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {slides.map((img, i) => (
            <div key={`${img.url}-${img.color ?? "global"}-${i}`} className="relative h-full w-full shrink-0">
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
        {(productFullyOut || outOfStock || invalidCombo) ? (
          <span className="absolute right-2 top-2 z-10 rounded-xs bg-status-error-fg px-2 py-1 text-[11px] font-semibold text-white">
            Out Of Stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-2">
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
          <div className="mt-3">
            <span className="inline-flex h-6 items-center rounded-[3px] border border-neutral-900 bg-neutral-900 px-2 text-[11px] font-medium uppercase text-white">
              {FREE_SIZE_LABEL}
            </span>
          </div>
        ) : (
          <>
            <div className="mt-3 flex min-h-4 items-center gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-4 w-4 rounded-full border border-[#d9dee7] ring-offset-1",
                    color === c && "ring-1 ring-brand-500"
                  )}
                  style={{ backgroundColor: colorSwatch(c) }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center flex-wrap gap-1.5 justify-between">
              <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
                {sizes.length ? (
                  sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={size === s}
                      onClick={() => setSize(s)}
                      className={cn(
                        "h-6 min-w-5 sm:min-w-7 rounded-[3px] border border-[#e1e5eb] px-2 text-[11px] font-medium uppercase text-neutral-900",
                        size === s && "border-neutral-900 bg-neutral-900 text-white"
                      )}
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  <span className="inline-flex h-6 items-center rounded-[3px] border border-neutral-900 bg-neutral-900 px-1 sm:px-2 text-[11px] font-medium uppercase text-white">
                    {FREE_SIZE_LABEL}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12px] font-bold tabular-nums border border-neutral-muted rounded-md px-2 py-1 leading-none text-neutral-muted">
                {invalidCombo || outOfStock ? "0 in stock" : `${stock} in stock`}
              </p>
            </div>
          </>
        )}


        <div className="mt-3 flex items-center flex-wrap justify-center sm:justify-between gap-2">
          <QtyStepper
            value={selectedQty}
            min={outOfStock ? 0 : 1}
            max={Math.max(0, stock)}
            onChange={setQty}
          />
          <button
            type="button"
            disabled={outOfStock || invalidCombo || needsSelection || selectedQty < 1}
            className=" rounded-[3px] bg-brand-500 w-full px-3 text-[13px] py-2 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
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
              const result = await addItem(
                product,
                selectedQty,
                freeSize ? { size: "", color: "" } : { size, color }
              );
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Added to cart");
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
