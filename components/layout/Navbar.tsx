"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationsPopover } from "@/components/layout/NotificationsPopover";

export function Navbar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));

  return (
    <header className="border-b border-[#e5e7eb] sticky top-0 z-50 bg-white">
      <div
        className={`mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 ${isAuthenticated ? "py-1" : "py-3.25"}`}
      >
        <Link
          href="/products"
          className="text-[15px] font-semibold tracking-tight text-[#333333]"
        >
          Bhai ka Store
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/cart"
            className="relative p-1 text-[#333333] hover:text-brand-500"
            aria-label="Shopping bag"
          >
            <ShoppingBag className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.5} />
            {itemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>

          {isAuthenticated ? <NotificationsPopover /> : null}

          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link
              href="/login"
              className="text-[14px] font-medium text-brand-500 hover:text-brand-500"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
