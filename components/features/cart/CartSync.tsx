"use client";

import { useEffect } from "react";

import { useSession } from "next-auth/react";

import { useCartStore } from "@/lib/store/useCartStore";

/** Loads server cart when authenticated; clears local cache on logout. */
export function CartSync() {
  const { status } = useSession();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const clearLocal = useCartStore((s) => s.clearLocal);
  const items = useCartStore((s) => s.items);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      clearLocal();
      // Drop legacy localStorage cart
      try {
        window.localStorage.removeItem("user-module-cart");
      } catch {
        // ignore
      }
      return;
    }
    void fetchCart();
  }, [status, fetchCart, clearLocal]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const deadlines = items.map((item) => Date.parse(item.expiresAt ?? "")).filter(Number.isFinite);
    if (!deadlines.length) return;
    // The backend decides what expired; the browser only refreshes its cache.
    const timer = window.setTimeout(
      () => void fetchCart(),
      Math.max(1_000, Math.min(...deadlines) - Date.now() + 100)
    );
    const refresh = () => void fetchCart();
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [status, items, fetchCart]);

  return null;
}
