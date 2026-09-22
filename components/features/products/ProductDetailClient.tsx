"use client";

import { memo, useMemo, useState } from "react";

import { Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { openStoreAi } from "@/components/features/chat/ProductChatDrawer";
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

function defaultInStockVariant(product: Product): { color: string; size: string } {
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

export const ProductDetailClient = memo(function ProductDetailClient({
  product,
}: {
  product: Product;
}) {
  const colors = useMemo(() => allColors(product), [product]);
  const hasVariants = Boolean(product.variants?.length);
  const freeSize = isFreeSizeProduct(product);
  const initial = useMemo(() => defaultInStockVariant(product), [product]);

  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);

  const sizes = useMemo(() => sizesForColor(product, color), [product, color]);
  const selectedVariant = findVariant(product.variants, color, size);
  const totalStock = hasVariants
    ? (product.variants?.reduce((sum, v) => sum + v.qty, 0) ?? 0)
    : (product.stock ?? 0);
  const baseStock = hasVariants ? (selectedVariant?.qty ?? 0) : (product.stock ?? 0);

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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      {/* Gallery */}
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-neutral-border/70 bg-neutral-bg">
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
                  src={img.url || "/products/tee.jpg"}
                  alt={product.name}
                  fill
                  priority={i === 0}
                  className="object-contain p-6 sm:p-8"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            ))}
          </div>
          {(productFullyOut || outOfStock || invalidCombo) && (
            <span className="absolute right-3 top-3 z-10 rounded-md bg-status-error-fg px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              Out of stock
            </span>
          )}
        </div>

        {slides.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((img, i) => (
              <button
                key={`thumb-${img.url}-${i}`}
                type="button"
                onClick={() => {
                  const slideColor = img.color;
                  if (slideColor) selectColor(slideColor);
                }}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white transition",
                  i === slideIndex
                    ? "border-brand-500 ring-2 ring-brand-500/20"
                    : "border-neutral-border/70 hover:border-brand-500/40"
                )}
              >
                <Image
                  src={img.url || "/products/tee.jpg"}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Purchase panel */}
      <div className="flex flex-col">
        {product.category && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            {product.category.name}
          </p>
        )}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-900">
          {formatCurrency(product.price)}
        </p>

        <div className="mt-6 space-y-5 border-t border-neutral-border/70 pt-6">
          {freeSize ? (
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-8 items-center rounded-lg border border-neutral-900 bg-neutral-900 px-3 text-xs font-medium uppercase text-white">
                {FREE_SIZE_LABEL}
              </span>
              <p className="rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-semibold tabular-nums text-neutral-muted">
                {outOfStock ? "0 in stock" : `${stock} in stock`}
              </p>
            </div>
          ) : (
            <>
              {colors.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-neutral-muted">Color</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Select ${c}`}
                        aria-pressed={color === c}
                        onClick={() => selectColor(c)}
                        className={cn(
                          "h-8 w-8 rounded-full border border-neutral-border ring-offset-2 transition",
                          color === c && "ring-2 ring-brand-500"
                        )}
                        style={{ backgroundColor: colorSwatch(c) }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-neutral-muted">Size</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {sizes.length ? (
                      sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={size === s}
                          onClick={() => setSize(s)}
                          className={cn(
                            "h-9 min-w-10 rounded-lg border border-neutral-border px-3 text-xs font-medium uppercase text-neutral-900 transition",
                            size === s && "border-neutral-900 bg-neutral-900 text-white"
                          )}
                        >
                          {s}
                        </button>
                      ))
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-lg border border-neutral-900 bg-neutral-900 px-3 text-xs font-medium uppercase text-white">
                        {FREE_SIZE_LABEL}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-6 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-semibold tabular-nums text-neutral-muted">
                  {invalidCombo || outOfStock ? "0 in stock" : `${stock} in stock`}
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <QtyStepper
              value={selectedQty}
              min={outOfStock ? 0 : 1}
              max={Math.max(0, stock)}
              onChange={setQty}
            />
            <button
              type="button"
              disabled={outOfStock || invalidCombo || needsSelection || selectedQty < 1}
              className="flex-1 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-500/20 transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
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

          <button
            type="button"
            onClick={() =>
              openStoreAi({
                productName: product.name,
                prompt: `Tell me more about ${product.name} — available colors, sizes, price, and stock.`,
              })
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI about this product
          </button>
        </div>
      </div>
    </div>
  );
});
