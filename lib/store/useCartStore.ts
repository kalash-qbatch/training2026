"use client";

import { create } from "zustand";

import {
  addCartItem,
  clearCartApi,
  fetchCart,
  removeCartItemApi,
  removeCartItemsApi,
  updateCartItemApi,
} from "@/lib/api/cart";
import { TAX_RATE } from "@/lib/constants";
import type { CartItem, CartState } from "@/types";

function matchesLine(item: CartItem, productId: string, specificationId?: string) {
  return item.productId === productId && (item.specificationId || "") === (specificationId || "");
}

function lineKey(productId: string, specificationId?: string) {
  return `${productId}::${specificationId || ""}`;
}

/** One queued PATCH per click (sequential, no coalesce). */
const qtyQueues = new Map<string, number[]>();
const inflightQty = new Set<string>();

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
    const item = get().items.find((i) => matchesLine(i, productId, specificationId));
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
      const nextQty = items.find((i) => matchesLine(i, product.id, specId))?.qty ?? qty;
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
    const key = lineKey(productId, specId);

    // Instant UI — each click updates local qty immediately
    set({
      items: get().items.map((i) => (matchesLine(i, productId, specId) ? { ...i, qty } : i)),
    });

    const queue = qtyQueues.get(key) ?? [];
    queue.push(qty);
    qtyQueues.set(key, queue);

    if (inflightQty.has(key)) return;
    inflightQty.add(key);

    try {
      while ((qtyQueues.get(key)?.length ?? 0) > 0) {
        const nextQty = qtyQueues.get(key)!.shift()!;
        try {
          const items = await updateCartItemApi({
            productId,
            specificationId: specId,
            quantity: nextQty,
          });
          // Keep optimistic qty if more clicks are still queued
          if ((qtyQueues.get(key)?.length ?? 0) === 0) {
            set({ items, loaded: true });
          }
        } catch (err) {
          qtyQueues.delete(key);
          try {
            const items = await fetchCart();
            set({ items, loaded: true });
          } catch {
            /* keep optimistic state if refetch fails */
          }
          throw err;
        }
      }
    } finally {
      inflightQty.delete(key);
      if ((qtyQueues.get(key)?.length ?? 0) === 0) {
        qtyQueues.delete(key);
      }
    }
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
  clearCart: async () => {
    const items = await clearCartApi();
    set({ items, loaded: true });
  },
  getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
  getTax: () => Number((get().getSubtotal() * TAX_RATE).toFixed(2)),
  getTotal: () => Number((get().getSubtotal() + get().getTax()).toFixed(2)),
}));
