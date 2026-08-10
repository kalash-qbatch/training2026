"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/types";
import { formatCurrency } from "@/lib/utils";
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
  if (product.colors?.length) return [...new Set(product.colors)];
  if (product.color) return [product.color];
  return [];
}

function allSizes(product: Product): string[] {
  if (product.variants?.length) {
    return [...new Set(product.variants.map((v) => v.size).filter(Boolean))];
  }
  if (product.sizes?.length) return [...new Set(product.sizes)];
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

  return {
    color: allColors(product)[0] ?? "",
    size: allSizes(product)[0] ?? "",
  };
}

export function ProductCard({ product }: { product: Product }) {
  const colors = useMemo(() => allColors(product), [product]);
  const sizes = useMemo(() => allSizes(product), [product]);
  const hasVariants = Boolean(product.variants?.length);

  const initial = useMemo(
    () => defaultInStockVariant(product),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id]
  );
  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);

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

  const [qty, setQty] = useState(outOfStock ? 0 : 1);
  const addItem = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (stock > 0 && qty > stock) setQty(stock);
    if (stock <= 0) setQty(0);
    if (stock > 0 && qty < 1) setQty(1);
  }, [stock, qty]);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[4px] border border-[#d0d5dd] bg-white">
      <div className="relative aspect-[5/4] w-full bg-[#f3f4f6]">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {(productFullyOut || outOfStock || invalidCombo) ? (
          <span className="absolute right-2 top-2 z-10 rounded-[2px] bg-[#e53935] px-2 py-1 text-[11px] font-semibold text-white">
            Out Of Stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 min-h-[40px] text-[14px] font-semibold leading-[20px] text-[#111827]">
          {product.name}
        </h3>
        {product.category?.name ? (
          <p className="mt-1 text-[12px] text-[#8a94a6]">{product.category.name}</p>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[13px] leading-none">
            <span className="text-[#6b7280]">Price: </span>
            <span className="font-bold tabular-nums text-brand-500">
              {formatCurrency(product.price)}
            </span>
          </p>
          <p
            className={`text-[12px] font-medium ${
              outOfStock || invalidCombo ? "text-[#e53935]" : "text-[#22c55e]"
            }`}
          >
            {invalidCombo
              ? "Out of stock"
              : outOfStock
                ? "Out of stock"
                : `${stock} Items Left`}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="h-9 rounded-[3px] cursor-pointer border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#333] outline-none focus:border-brand-500"
            aria-label="Select size"
          >
            {sizes.length === 0 ? (
              <option value="">No sizes</option>
            ) : (
              sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 rounded-[3px] cursor-pointer border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#333] outline-none focus:border-brand-500"
            aria-label="Select color"
          >
            {colors.length === 0 ? (
              <option value="">No colors</option>
            ) : (
              colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <QtyStepper
            value={outOfStock ? 0 : Math.max(1, qty)}
            min={outOfStock ? 0 : 1}
            max={Math.max(0, stock)}
            onChange={setQty}
          />
          <button
            type="button"
            disabled={outOfStock || invalidCombo || !color || !size}
            className="h-[34px] flex-1 rounded-[3px] cursor-pointer bg-brand-500 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={async () => {
              if (!isAuthenticated) {
                router.push("/login");
                return;
              }
              if (invalidCombo) {
                toast.error("That color and size combination is out of stock");
                return;
              }
              const result = await addItem(product, qty, { size, color });
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
