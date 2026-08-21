"use client";

import { useMemo, useState } from "react";

import { X } from "lucide-react";
import Image from "next/image";

import { Modal } from "@/components/ui/Modal";
import { FREE_SIZE_LABEL, getColorSlideIndex, isFreeSizeProduct } from "@/lib/product";
import { cn, colorSwatch, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

function PreviewContent({ product }: { product: Product }) {
  const freeSize = isFreeSizeProduct(product);
  const colors = useMemo(
    () =>
      product.variants?.length
        ? [...new Set(product.variants.map((v) => v.color).filter(Boolean))]
        : [],
    [product.variants]
  );
  const sizes = useMemo(
    () =>
      product.variants?.length
        ? [...new Set(product.variants.map((v) => v.size).filter(Boolean))]
        : [],
    [product.variants]
  );

  const initial = useMemo(() => {
    const inStock = product.variants?.find((v) => v.qty > 0);
    const first = inStock ?? product.variants?.[0];
    return { color: first?.color ?? "", size: first?.size ?? "" };
  }, [product.variants]);

  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);

  const selectedVariant = product.variants?.find(
    (v) =>
      v.color.toLowerCase() === color.toLowerCase() && v.size.toLowerCase() === size.toLowerCase()
  );
  const stock = product.variants?.length ? (selectedVariant?.qty ?? 0) : (product.stock ?? 0);

  const slides = useMemo(() => {
    if (product.images?.length) return product.images;
    return [{ url: product.imageUrl, color: undefined as string | undefined }];
  }, [product.images, product.imageUrl]);
  const slideIndex = useMemo(
    () => getColorSlideIndex(slides, colors, color),
    [slides, colors, color]
  );

  return (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-[#eef1f4]">
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {slides.map((img, i) => (
            <div
              key={`${img.url}-${img.color ?? "global"}-${i}`}
              className="relative h-full w-full shrink-0"
            >
              <Image src={img.url} alt={product.name} fill className="object-cover" sizes="400px" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 pt-4">
        <h3 className="text-[16px] font-semibold text-neutral-900">{product.name}</h3>

        <p className="mt-3 text-[14px]">
          <span className="text-[#6b7280]">Price: </span>
          <span className="text-[18px] font-bold tabular-nums text-brand-500">
            {formatCurrency(product.price)}
          </span>
        </p>

        {freeSize ? (
          <div className="mt-3">
            <span className="inline-flex h-7 items-center rounded-sm bg-neutral-900 px-2.5 text-[11px] font-medium uppercase text-white">
              {FREE_SIZE_LABEL}
            </span>
          </div>
        ) : (
          <>
            <div className="mt-3 flex min-h-6 items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border border-[#d9dee7] ring-offset-2",
                    color === c && "ring-2 ring-brand-500"
                  )}
                  style={{ backgroundColor: colorSwatch(c) }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sizes.length ? (
                sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={size === s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "h-8 min-w-10 rounded-md border border-[#e1e5eb] px-3 text-[12px] font-semibold uppercase text-neutral-900",
                      size === s && "border-neutral-900 bg-neutral-900 text-white"
                    )}
                  >
                    {s}
                  </button>
                ))
              ) : (
                <span className="inline-flex h-7 items-center rounded-sm bg-neutral-900 px-2.5 text-[11px] font-medium uppercase text-white">
                  {FREE_SIZE_LABEL}
                </span>
              )}
            </div>
          </>
        )}

        <p className="mt-3 text-[13px] text-neutral-muted">{stock} in stock</p>
      </div>
    </>
  );
}

export function ProductPreviewModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product?.name ?? "Product preview"}
      hideHeader
      className="relative max-w-100 overflow-hidden rounded-2xl p-0"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm hover:bg-white"
        aria-label="Close preview"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
      {product ? <PreviewContent key={product.id} product={product} /> : null}
    </Modal>
  );
}
