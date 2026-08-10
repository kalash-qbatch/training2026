"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/lib/store/useCartStore";

/** Loads server cart when authenticated; clears local cache on logout. */
export function CartSync() {
  const { status } = useSession();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const clearLocal = useCartStore((s) => s.clearLocal);

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

  return null;
}
