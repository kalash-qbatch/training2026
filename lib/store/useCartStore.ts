"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Order, Product } from "@/types";

type AddItemResult =
  | { ok: true; qty: number }
  | { ok: false; error: string };

type CartState = {
  items: CartItem[];
  orders: Order[];
  addItem: (
    product: Product,
    qty: number,
    opts?: { color?: string; size?: string }
  ) => AddItemResult;
  updateQty: (
    productId: string,
    qty: number,
    size?: string,
    color?: string
  ) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  removeMissingProducts: (validProductIds: string[]) => void;
  clearCart: () => void;
  addLocalOrder: (order: Order) => void;
  getCartQty: (productId: string, size?: string, color?: string) => number;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
};

const TAX_RATE = 0.08;

function itemKey(productId: string, size?: string, color?: string) {
  return `${productId}::${size ?? ""}::${color ?? ""}`;
}

function availableStock(
  product: Product,
  size?: string,
  color?: string
): number {
  if (size && color && product.variants?.length) {
    const variant = product.variants.find(
      (v) =>
        v.size.toLowerCase() === size.toLowerCase() &&
        v.color.toLowerCase() === color.toLowerCase()
    );
    if (variant) return variant.qty;
  }
  return product.stock ?? 0;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orders: [],
      getCartQty: (productId, size, color) =>
        get().items
          .filter(
            (i) => itemKey(i.productId, i.size, i.color) === itemKey(productId, size, color)
          )
          .reduce((sum, i) => sum + i.qty, 0),
      addItem: (product, qty, opts) => {
        const size = opts?.size ?? product.sizes?.[0];
        const color = opts?.color ?? product.color;
        const stock = availableStock(product, size, color);
        const key = itemKey(product.id, size, color);
        const existing = get().items.find(
          (i) => itemKey(i.productId, i.size, i.color) === key
        );
        const currentQty = existing?.qty ?? 0;
        const nextQty = currentQty + qty;

        if (stock <= 0) {
          return { ok: false, error: "This product is out of stock" };
        }
        if (qty < 1) {
          return { ok: false, error: "Quantity must be at least 1" };
        }
        if (nextQty > stock) {
          const left = stock - currentQty;
          if (left <= 0) {
            return {
              ok: false,
              error: `Only ${stock} in stock. You already have ${currentQty} in cart.`,
            };
          }
          return {
            ok: false,
            error: `Only ${stock} in stock. You can add ${left} more.`,
          };
        }

        set((state) => {
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i.productId, i.size, i.color) === key
                  ? { ...i, qty: nextQty, stock }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                color,
                size,
                price: product.price,
                qty,
                stock,
              },
            ],
          };
        });

        return { ok: true, qty };
      },
      updateQty: (productId, qty, size, color) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (itemKey(i.productId, i.size, i.color) !== itemKey(productId, size, color)) {
              return i;
            }
            const max = i.stock ?? Infinity;
            return { ...i, qty: Math.min(max, Math.max(1, qty)) };
          }),
        }));
      },
      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (i) =>
              itemKey(i.productId, i.size, i.color) !==
              itemKey(productId, size, color)
          ),
        }));
      },
      removeMissingProducts: (validProductIds) => {
        const valid = new Set(validProductIds);
        set((state) => ({
          items: state.items.filter((i) => valid.has(i.productId)),
        }));
      },
      clearCart: () => set({ items: [] }),
      addLocalOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders],
        })),
      getSubtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      getTax: () => Number((get().getSubtotal() * TAX_RATE).toFixed(2)),
      getTotal: () => Number((get().getSubtotal() + get().getTax()).toFixed(2)),
    }),
    { name: "user-module-cart" }
  )
);
