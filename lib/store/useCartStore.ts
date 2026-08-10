"use client";

import { create } from "zustand";
import type { CartItem, Product } from "@/types";
import {
  addCartItem,
  fetchCart,
  removeCartItemApi,
  removeCartItemsApi,
  updateCartItemApi,
} from "@/lib/api/cart";

type AddItemResult =
  | { ok: true; qty: number }
  | { ok: false; error: string };

type CartState = {
  items: CartItem[];
  loaded: boolean;
  setItems: (items: CartItem[]) => void;
  fetchCart: () => Promise<void>;
  clearLocal: () => void;
  addItem: (
    product: Product,
    qty: number,
    opts?: { color?: string; size?: string }
  ) => Promise<AddItemResult>;
  updateQty: (
    productId: string,
    qty: number,
    size?: string,
    color?: string
  ) => Promise<void>;
  removeItem: (
    productId: string,
    size?: string,
    color?: string
  ) => Promise<void>;
  removeItems: (
    items: Array<{ productId: string; size?: string; color?: string }>
  ) => Promise<void>;
  getCartQty: (productId: string, size?: string, color?: string) => number;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
};

const TAX_RATE = 0.08;

function itemKey(productId: string, size?: string, color?: string) {
  return `${productId}::${size ?? ""}::${color ?? ""}`;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  loaded: false,
  setItems: (items) => set({ items, loaded: true }),
  clearLocal: () => set({ items: [], loaded: false }),
  fetchCart: async () => {
    try {
      const items = await fetchCart();
      set({ items, loaded: true });
    } catch {
      set({ items: [], loaded: true });
    }
  },
  getCartQty: (productId, size, color) =>
    get()
      .items.filter(
        (i) =>
          itemKey(i.productId, i.size, i.color) ===
          itemKey(productId, size, color)
      )
      .reduce((sum, i) => sum + i.qty, 0),
  addItem: async (product, qty, opts) => {
    const size = opts?.size ?? product.sizes?.[0];
    const color = opts?.color ?? product.color;
    try {
      const items = await addCartItem({
        productId: product.id,
        quantity: qty,
        color,
        size,
      });
      set({ items, loaded: true });
      const nextQty =
        items.find(
          (i) =>
            itemKey(i.productId, i.size, i.color) ===
            itemKey(product.id, size, color)
        )?.qty ?? qty;
      return { ok: true, qty: nextQty };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to add to cart",
      };
    }
  },
  updateQty: async (productId, qty, size, color) => {
    const items = await updateCartItemApi({
      productId,
      quantity: qty,
      color,
      size,
    });
    set({ items, loaded: true });
  },
  removeItem: async (productId, size, color) => {
    const items = await removeCartItemApi({ productId, color, size });
    set({ items, loaded: true });
  },
  removeItems: async (lines) => {
    const items = await removeCartItemsApi(
      lines.map((i) => ({
        productId: i.productId,
        color: i.color,
        size: i.size,
      }))
    );
    set({ items, loaded: true });
  },
  getSubtotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
  getTax: () => Number((get().getSubtotal() * TAX_RATE).toFixed(2)),
  getTotal: () => Number((get().getSubtotal() + get().getTax()).toFixed(2)),
}));
