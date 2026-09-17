"use client";

import { useEffect } from "react";

import { useSession } from "next-auth/react";

import { useCartStore } from "@/lib/store/useCartStore";

/** Loads server cart when authenticated; clears local cache on logout. */
export function CartSync() {
  const { status } = useSession();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const clearLocal = useCartStore((s) => s.clearLocal);
  const earliestExpiry = useCartStore((s) => {
    let min = Number.POSITIVE_INFINITY;
    for (const item of s.items) {
      const t = Date.parse(item.expiresAt ?? "");
      if (Number.isFinite(t) && t < min) min = t;
    }
    return Number.isFinite(min) ? min : null;
  });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      clearLocal();
      try {
        window.localStorage.removeItem("user-module-cart");
      } catch {
        // ignore
      }
      return;
    }
    void fetchCart();
  }, [status, fetchCart, clearLocal]);

  // Refresh only when a line is about to expire — not on every window focus.
  useEffect(() => {
    if (status !== "authenticated" || earliestExpiry == null) return;
    const timer = window.setTimeout(
      () => void fetchCart(),
      Math.max(1_000, earliestExpiry - Date.now() + 100)
    );
    return () => window.clearTimeout(timer);
  }, [status, earliestExpiry, fetchCart]);

  return null;
}
