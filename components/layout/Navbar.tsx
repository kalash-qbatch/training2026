"use client";

import Link from "next/link";
import { Bell, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { UserMenu } from "@/components/layout/UserMenu";

export function Navbar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));

  return (
    <header className="border-b border-[#e5e7eb] sticky top-0 z-50 bg-white">
      <div className={`mx-auto flex items-center justify-between ${isAuthenticated ? 'py-1' : 'py-3.25'} px-6 lg:px-8`}>
        <Link
          href="/products"
          className="text-[15px] font-semibold tracking-tight text-[#333333]"
        >
          E-commerce
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/cart"
            className="relative text-[#333333] hover:text-brand-500"
            aria-label="Shopping bag"
          >
            <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.5} />
            {itemCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="text-[#333333] hover:text-brand-500"
            aria-label="Notifications"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>

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
