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
    opts?: { specificationId?: string }
  ) => Promise<AddItemResult>;
  updateQty: (
    productId: string,
    qty: number,
    specificationId?: string
  ) => Promise<void>;
  removeItem: (
    productId: string,
    specificationId?: string
  ) => Promise<void>;
  removeItems: (
    items: Array<{ productId: string; specificationId?: string }>
  ) => Promise<void>;
  getCartQty: (productId: string, specificationId?: string) => number;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
};

const TAX_RATE = 0.08;

function matchesLine(item: CartItem, productId: string, specificationId?: string) {
  return (
    item.productId === productId &&
    (item.specificationId || "") === (specificationId || "")
  );
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
  getCartQty: (productId, specificationId) => {
    const item = get().items.find((i) =>
      matchesLine(i, productId, specificationId)
    );
    return item ? item.qty : 0;
  },
  addItem: async (product, qty, opts) => {
    const specId = opts?.specificationId?.trim() || undefined;
    try {
      const items = await addCartItem({
        productId: product.id,
        specificationId: specId,
        quantity: qty,
      });
      set({ items, loaded: true });
      const nextQty =
        items.find((i) => matchesLine(i, product.id, specId))?.qty ?? qty;
      return { ok: true, qty: nextQty };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to add to cart",
      };
    }
  },
  updateQty: async (productId, qty, specificationId) => {
    const specId = specificationId?.trim() || undefined;
    const items = await updateCartItemApi({
      productId,
      specificationId: specId,
      quantity: qty,
    });
    set({ items, loaded: true });
  },
  removeItem: async (productId, specificationId) => {
    const specId = specificationId?.trim() || undefined;
    const items = await removeCartItemApi({
      productId,
      specificationId: specId,
    });
    set({ items, loaded: true });
  },
  removeItems: async (lines) => {
    const items = await removeCartItemsApi(
      lines.map((i) => ({
        productId: i.productId,
        specificationId: i.specificationId?.trim() || undefined,
      }))
    );
    set({ items, loaded: true });
  },
  getSubtotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
  getTax: () => Number((get().getSubtotal() * TAX_RATE).toFixed(2)),
  getTotal: () => Number((get().getSubtotal() + get().getTax()).toFixed(2)),
}));
